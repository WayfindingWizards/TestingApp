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

  constructor(private capacity: number = 30) {} // adjust capacity

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
let numOfSamples = 0;
const deviceBuffer = new Queue<number[]>; // [rssi, xCoord, yCoord]

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
        // Identify beacons belonging to us
        if (device?.name?.includes('BCPro')) {  // General Identifiers = { BlueCharm:'BCPro', Feasy:'IPSWW' }
          const deviceRssi = device.rssi!;
          const deviceID = device.id;
          let xCoord = -1;
          let yCoord = -1;
          let beaconNum = -1;
          //const queueSize = 20;

          // Match deviceID to beacon
          switch (deviceID){
            case 'DD:60:03:00:02:C0': //Feasy: fda50693a4e24fb1afcfc6eb07647825
              setRs1(deviceRssi); //set rssi to display (for testing)
              xCoord = 0;
              yCoord = 0;
              beaconNum = 1;
              //replace oldest beacon data
              if (deviceBuffer.size() >= 20) {
                deviceBuffer.dequeue();
              }
              deviceBuffer.enqueue([deviceRssi, xCoord, yCoord, beaconNum]);
              break;
            case 'DD:60:03:00:03:3C': //Feasy: 00000000000000000000000000000000
              setRs2(deviceRssi);
              xCoord = 3;
              yCoord = 0;
              beaconNum = 2;
              //replace oldest beacon data
              if (deviceBuffer.size() >= 20) {
                deviceBuffer.dequeue();
              }
              deviceBuffer.enqueue([deviceRssi, xCoord, yCoord, beaconNum]);
              break;
            case 'DD:60:03:00:03:3C': //Feasy: fda50693a4e24fb1afcfc6eb07647826
              setRs3(-50); //***test value: change to deviceRssi
              xCoord = 1.5;
              yCoord = 30;
              beaconNum = 3;
              //replace oldest beacon data
              if (deviceBuffer.size() >= 20) {
                deviceBuffer.dequeue();
              }
              deviceBuffer.enqueue([deviceRssi, xCoord, yCoord, beaconNum]);
              break;
          }
          // order by distance (may be unoptimal, could use "sorted queue"?)
          let orderedBuffer: Array<number[]> = new Array<number[]>; // We keep an ordered buffer so that when more than 3 beacons are in range we trilaterate using the 3 closest beacons
          let devicePackage: number[] | undefined = [-1,-1,-1];
          //console.log(deviceBuffer.size());
          //console.log(devicePackage);
          // put queue into array to be sorted
          for (let i = 0; i < deviceBuffer.size(); i++){
            if (devicePackage !== undefined && deviceBuffer !== undefined) {
              devicePackage = deviceBuffer.dequeue();
              //console.log(devicePackage);
              orderedBuffer.push(devicePackage as number[]);
              if (devicePackage !== undefined && deviceBuffer !== undefined) {
                deviceBuffer.enqueue(devicePackage)
              }
            }
          }

          function trilaterate(beacon1: Array<number>, beacon2: Array<number>, beacon3: Array<number>) {
            const d1 = Math.pow(10, (-40 - beacon1[0]!) / (10 * 3));  // -40: rssi@1m; 3: path loss exponent
            const d2 = Math.pow(10, (-40 - beacon2[0]!) / (10 * 3));
            const d3 = Math.pow(10, (-40 - beacon3[0]!) / (10 * 3));
            // console.log(d1);
            // console.log(d2);
            // console.log(d3);
            // console.log('----------');
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

          orderedBuffer.sort((a, b) => b[0] - a[0]); // order by descending distance/RSSI
          // console.log(orderedBuffer[0]);
          // console.log(orderedBuffer[1]);
          // console.log(orderedBuffer[2]);
          // console.log('-------------');

          // pick out 3 closest unique beacons
          let closestBeacons: Array<number[]> = new Array<number[]>;
          let i = 0;
          while (closestBeacons.length < 3) {
            if (closestBeacons.length==0){
              closestBeacons.push(orderedBuffer[i]);
            }
            else if (closestBeacons.length==1 && orderedBuffer[i][3] != closestBeacons[0][3]){
              closestBeacons.push(orderedBuffer[i]);
            }
            else if (closestBeacons.length==2 && orderedBuffer[i][3] != closestBeacons[0][3] && orderedBuffer[i][3] != closestBeacons[1][3]){
              closestBeacons.push(orderedBuffer[i]);
            }
            i++;
          }
          console.log(closestBeacons[0][3]);
          console.log(closestBeacons[1][3]);
          console.log(closestBeacons[2][3]);
          console.log('----------');


          if (orderedBuffer.length >= 3){
            let userCoords: number[] = trilaterate(orderedBuffer[0], orderedBuffer[1], orderedBuffer[2]);
            setLocation(userCoords);
            //console.log(userCoords);
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