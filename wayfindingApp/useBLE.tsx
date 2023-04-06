// To run app:
// connect device or start emulator
// check device is connected by running: adb devices
// in cmd navigate to project folder and run: npx react-native start
// in another cmd window navigate to project folder and run: npx react-native run-android

/* eslint-disable no-bitwise */
import {useState} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager, ScanMode} from 'react-native-ble-plx';
import {PERMISSIONS, requestMultiple} from 'react-native-permissions';
import DeviceInfo from 'react-native-device-info';
import 'csv-parse';


const bleManager = new BleManager();

type VoidCallback = (result: boolean) => void;

interface BluetoothLowEnergyApi {
  requestPermissions(cb: VoidCallback): Promise<void>;
  scanForPeripherals(): void;
  closestBeacon: number;
}

// csv handling
// from: https://nodogmablog.bryanhogan.net/2020/10/reading-csv-files-into-objects-with-node-js/
var fs = require('fs');
var { parse } = require('csv-parse');


function readCSV() {
    let beacons: Array<Beacon> = [];
    let count = 0;

    fs.createReadStream('beaconIDs.csv')
        .pipe(parse({ delimiter: ',', from_line: 2 }))
        .on('data', function (row: string[]) {
            count++;
            beacons.push(new Beacon(row[0] as unknown as number, row[1]))

            
        })
        .on('end', function () {
            printBeacons(beacons);
        });
}

function printBeacons(beacons: Array<Beacon>) {
    console.log(beacons);
}

// class Beacon {
//     constructor(beaconNum, macAddress) {
//         this.beaconNum = beaconNum;
//         this.macAddress = macAddress;
//     }
// }

// beacon class
class Beacon {
  private timeOfSignal: number = undefined as unknown as number;
  private rssi: number = undefined as unknown as number;
  private macAddress: string;
  private beaconNum: number;
  

  // constructor(timeOfSignal: number, rssi: number, macAddress: string) {
  //   this.timeOfSignal = timeOfSignal;
  //   this.rssi = rssi;
  //   this.macAddress = macAddress;
  //   this.beaconNum = findNum(this.macAddress);  // get beacon number with ID from csv file, there are csv packages to help
  // }

  constructor(beaconNum: number, macAddress: string) {
    this.beaconNum = beaconNum;
    this.macAddress = macAddress;
  }

  getTimeOfSignal() {
    return this.timeOfSignal;
  }

  getRssi() {
    return this.rssi;
  }

  getBeaconNum() {
    return this.beaconNum;
  }

  setTimeofSignal(timeOfSignal: number) {
    this.timeOfSignal = timeOfSignal;
  }

  setRssi(rssi: number) {
    this.rssi = rssi;
  }
  
}

readCSV();



// for lines in beaconIDs.csv:
  // create new Beacon object



// variables to declare outside of scan
const numberOfBeacons = 6;
let beaconSignals = new Array<number>(numberOfBeacons); // beaconSignals is an array where beaconSignals[beaconNum] = rssi
let signalTimes = new Array<number>(numberOfBeacons);
let deleteOld = false;
let prevTime = Date.now();
let recentClosest: number[] = [];

function useBLE(): BluetoothLowEnergyApi {
  const [closestBeacon, setclosestBeacon] = useState<number>(-1);

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
        // Parse signal from our beacons
        if (device?.name?.includes('Beacon' || 'BCPro')) {  // General Identifiers = { BlueCharm:'BCPro', Feasy:'Beacon' }
          // variables to declare each scan
          const deviceRssi = device.rssi!;
          const deviceID = device.id;
          let beaconNum: number = -1;
          let currentTime = Date.now();

          // Match deviceID to beacon and put signal in array
          switch (deviceID){  // is a dictionary better?
            case 'DC:0D:30:10:4E:F2': //Feasy1
              beaconNum = 0;
              break;
            case 'DC:0D:30:10:4F:57': //Feasy2
              beaconNum = 1;
              break;
            case 'DC:0D:30:10:4F:3D': //Feasy3
              beaconNum = 2;
              break;
            case 'DD:60:03:00:02:C0': //BC1
              beaconNum = 3;
              break;
            case 'DD:60:03:00:03:3C': //BC2
              beaconNum = 4;
              break;
            case 'DD:60:03:00:00:4F': //BC3
              beaconNum = 5;
              break;
          }

          beaconSignals[beaconNum] = deviceRssi;
          signalTimes[beaconNum] = currentTime;

          // invalidate old rssi values once every other scan
            // consider changing this to once every few scans or once every time period
          if (deleteOld){
            for(let i = 0; i < numberOfBeacons; i++){
              if((currentTime - signalTimes[i]) > 3000){
                beaconSignals[i] = -100;
                // console.log(i);
                // console.log({beaconSignals});
                // console.log({signalTimes});
                // console.log({currentTime});
                // console.log("OLD DATA RESETTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT");
                signalTimes[i] = undefined as unknown as number; // ignore error; setting as undefined prevents from continuously reseting signal when signal is lost
              }
            }  
          }

          deleteOld = !deleteOld;
          
          // add current closest to recentClosest
          recentClosest.push(beaconSignals.indexOf(beaconSignals.reduce((a, b) => Math.max(a, b), -Infinity)));

          function findMode(arr: Array<number>){  // find mode of recentClosest, if empty return -1  //****************** Other algorithms could improve this
            // check for empty array
            if(arr.length == 0){
              return -1;
            }

            // sort array
            arr = arr.sort((n1,n2) => n1 - n2);
            let mode: number = 0;
            let modeCount: number = 0;
            let currentCount: number = 0;

            // find mode
            for(let i = 1; i < arr.length; i++){
              if(arr[i-1] == arr[i]){
                currentCount += 1;
                if(currentCount > modeCount){
                  mode = arr[i];
                  modeCount = currentCount;
                }
              }
              else {
                currentCount = 0;
              }
            }
            console.log({mode});
            return mode;
          }

          // every second:
          if((currentTime - prevTime) > 1000){
            console.log({recentClosest});
            setclosestBeacon(findMode(recentClosest));
            recentClosest = [];
            prevTime = currentTime;
          }

          
        }
      },
    );

  return {
    scanForPeripherals,
    requestPermissions,
    //distance,
    closestBeacon,
  };
}

export default useBLE;