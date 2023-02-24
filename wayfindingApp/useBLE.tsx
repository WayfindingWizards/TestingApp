/* eslint-disable no-bitwise */
import {useState} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager, ScanMode} from 'react-native-ble-plx';
import {PERMISSIONS, requestMultiple} from 'react-native-permissions';
import DeviceInfo from 'react-native-device-info';

// Queue Implementation
// from https://dev.to/glebirovich/typescript-data-structures-stack-and-queue-hld
interface IQueue<T> {
  enqueue(item: T): void;
  dequeue(): T | undefined;
  size(): number;
}

class Queue<T> implements IQueue<T> {
  private storage: T[] = [];

  constructor(private capacity: number = Infinity) {} // adjust capacity

  enqueue(item: T): void {
    if (this.size() === this.capacity) {
      throw Error("Queue has reached max capacity, you cannot add more items");
    }
    this.storage.push(item);
  }
  dequeue(): T | undefined {
    return this.storage.shift();
  }
  size(): number {
    return this.storage.length;
  }
}
// -----------------------------------------

const bleManager = new BleManager();

type VoidCallback = (result: boolean) => void;

interface BluetoothLowEnergyApi {
  requestPermissions(cb: VoidCallback): Promise<void>;
  scanForPeripherals(): void;
  distance: number;
  location: number[];
  rs1: number;
  rs2: number;
  rs3: number;
}

const distanceBuffer: [number, number, number] = [-1, -1, -1];
//let numOfSamples = 0;

function useBLE(): BluetoothLowEnergyApi {
  const [distance, setDistance] = useState<number>(-1);
  const [location, setLocation] = useState<number[]>([-1, -1]);  // ***Question: Can we even have default values? How else do we do this?
  const [rs1, setRs1] = useState<number>(-1);
  const [rs2, setRs2] = useState<number>(-1);
  const [rs3, setRs3] = useState<number>(-1);

  const requestPermissions = async (cb: VoidCallback) => {
    if (Platform.OS === 'android') {
      const apiLevel = await DeviceInfo.getApiLevel();

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth Low Energy requires Location',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        cb(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const result = await requestMultiple([
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]);

        const isGranted =
          result['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] ===
            PermissionsAndroid.RESULTS.GRANTED;

        cb(isGranted);
      }
    } else {
      cb(true);
    }
  };

  const scanForPeripherals = () =>
    bleManager.startDeviceScan(
      null,
      {
        allowDuplicates: true,
        scanMode: ScanMode.LowLatency,
      },
      (error, device) => {
        if (device?.name?.includes('Beacon')) { // find beacon with general identifier
          const deviceRssi = device.rssi!; // ***QUESTION: Should we calculate distance within trilaterate() or before? Using the buffer estimation gets us a more accuract distance, but im not sure how to implement that when we are getting data from multiple beacons
          const deviceID = device.id;
          let xCoord = -1;
          let yCoord = -1;
          //let deviceBuffer = Array<[number, number, number]>; // queue would be appropriate to store by fifo
          const deviceBuffer = new Queue<number[]>; // [rssi, xCoord, yCoord]
          const queueSize = 20; //
          switch (deviceID){  // ***TODO: Set beacon IDs and coordinates
            case 'fda50693a4e24fb1afcfc6eb07647825':
              setRs1(deviceRssi);
              xCoord = 0;
              yCoord = 0;
              //replace oldest beacon data
              if (queueSize >= 20) {
                deviceBuffer.dequeue;}
              deviceBuffer.enqueue([deviceRssi, xCoord, yCoord]);
            case '00000000000000000000000000000000':
              setRs2(deviceRssi);
              xCoord = 3;
              yCoord = 0;
              //replace oldest beacon data
              if (queueSize >= 20) {
                deviceBuffer.dequeue; }
              deviceBuffer.enqueue([deviceRssi, xCoord, yCoord]);
            case 'fda50693a4e24fb1afcfc6eb07647826':
              setRs3(deviceRssi);
              xCoord = 3;
              yCoord = 3;
              //replace oldest beacon data
              if (queueSize >= 20) {
                deviceBuffer.dequeue;}
              deviceBuffer.enqueue([deviceRssi, xCoord, yCoord]);
          }
          // order by distance (may be unoptimal, could use "sorted queue"?)
          let orderedBuffer: Array<number[]> = new Array<number[]>;
          let devicePackage: number[] | undefined;
          // put queue into array to be sorted
          for (let i = 0; i < deviceBuffer.size(); i++){
            if (devicePackage !== undefined && deviceBuffer !== undefined) {
              devicePackage = deviceBuffer.dequeue();  // ***FIX: deviceBuffer.dequeue() could be undefined I guess?
              orderedBuffer.push(devicePackage as number[]);
              if (devicePackage !== undefined && deviceBuffer !== undefined) {
              deviceBuffer.enqueue(devicePackage);}
            }
          }

          function trilaterate(beacon1: Array<number>, beacon2: Array<number>, beacon3: Array<number>) {
            const d1 = Math.pow(10, (-40 - beacon1[0]!) / (10 * 3));  // -40: rssi@1m; 3: path loss exponent
            const d2 = Math.pow(10, (-40 - beacon2[0]!) / (10 * 3));
            const d3 = Math.pow(10, (-40 - beacon3[0]!) / (10 * 3));
            const x1 = beacon1[1];
            const x2 = beacon2[1];
            const x3 = beacon3[1];
            const y1 = beacon1[2];
            const y2 = beacon2[2];
            const y3 = beacon3[2];
            const a1 = -2*x1;
            const a2 = -2*x2;
            const a3 = -2*x3;
            const b1 = -2*y1;
            const b2 = -2*y2;
            const b3 = -2*y3;
            const c1 = x1**2 + y1**2 - d1**2;
            const c2 = x2**2 + y2**2 - d2**2;
            const c3 = x3**2 + y3**2 - d3**2;
            const x = ((c2-c1)*(b2-b1)-(c3-c2)*(b1-b2))/((a1-a2)*(b2-b3)-(a2-a3)*(b1-b2));
            const y = ((a2-a1)*(c3-c2)-(c2-c1)*(a2-a3))/((a1-a2)*(b2-b3)-(a2-a3)*(b1-b2));
            return [x, y];
          }

          orderedBuffer.sort((a, b) => a[0] - b[0]); // order by descending distance/RSSI
          if (orderedBuffer.length >= 3){
            let userCoords: number[] = trilaterate(orderedBuffer[0], orderedBuffer[1], orderedBuffer[2]);
            setLocation(userCoords);
          }
          // Old distance calculation for 1 beacon with average buffer
          /*const currentDistance = Math.pow(10, (-40 - device.rssi!) / (10 * 3));

          distanceBuffer[numOfSamples % 3] = currentDistance;

          if (distanceBuffer.includes(-1)) {
            setDistance(-1);
          } else {
            const sum = distanceBuffer.reduce((a, b) => a + b);
            setDistance(Math.round(sum / distanceBuffer.length));
          }

          numOfSamples++;*/
        }
      },
    );

  return {
    scanForPeripherals,
    requestPermissions,
    distance,
    location,
    rs1,
    rs2,
    rs3,
  };
}

export default useBLE;