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


const bleManager = new BleManager();

type VoidCallback = (result: boolean) => void;

interface BluetoothLowEnergyApi {
  requestPermissions(cb: VoidCallback): Promise<void>;
  scanForPeripherals(): void;
  closestBeacon: number;
}

// variables to declare outside of scan
const numberOfBeacons = 6;
let beaconSignals = new Array<number>(numberOfBeacons); // beaconSignals is an array where beaconSignals[beaconNum] = rssi
let signalTimes = new Array<number>(numberOfBeacons);
let deleteOldest = false;

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
          let beaconNum: number;
          let currentTime = Date.now();
          console.log({currentTime});
          let oldestBeacon: number;

          // Match deviceID to beacon and put signal in array
          switch (deviceID){
            case 'DC:0D:30:10:4E:F2': //Feasy1
              beaconNum = 0;
              beaconSignals[beaconNum] = deviceRssi;
              signalTimes[beaconNum] = currentTime;
              break;
            case 'DC:0D:30:10:4F:57': //Feasy2
              beaconNum = 1;
              beaconSignals[beaconNum] = deviceRssi;
              signalTimes[beaconNum] = currentTime;
              break;
            case 'DC:0D:30:10:4F:3D': //Feasy3
              beaconNum = 2;
              beaconSignals[beaconNum] = deviceRssi;
              signalTimes[beaconNum] = currentTime;
              break;
            case 'DD:60:03:00:02:C0': //BC1
              beaconNum = 3;
              beaconSignals[beaconNum] = deviceRssi;
              signalTimes[beaconNum] = currentTime;
              break;
            case 'DD:60:03:00:03:3C': //BC2
              beaconNum = 4;
              beaconSignals[beaconNum] = deviceRssi;
              signalTimes[beaconNum] = currentTime;
              break;
            case 'DD:60:03:00:00:4F': //BC3
              beaconNum = 5;
              beaconSignals[beaconNum] = deviceRssi;
              signalTimes[beaconNum] = currentTime;
              break;
          }

          console.log('------BEFORE------');
          console.log({beaconSignals});
          console.log({signalTimes});
          console.log({deleteOldest});
          
          // set closest beacon from largest rssi value
          setclosestBeacon(beaconSignals.indexOf(beaconSignals.reduce((a, b) => Math.max(a, b), -Infinity)));

          // invalidate oldest rssi value once every other scan
          if (deleteOldest){
            oldestBeacon = signalTimes.indexOf(signalTimes.reduce((a, b) => Math.min(a, b), Infinity));
            console.log({oldestBeacon});
            beaconSignals[oldestBeacon] = -100;
            signalTimes[oldestBeacon] = currentTime;  //reset signalTime for oldestBeacon (otherwise we would continue to invalidate the same beaconNum until we received a signal)
          }
          deleteOldest = !deleteOldest;
          console.log('------AFTER------');
          console.log({beaconSignals});
          console.log({signalTimes});
          console.log({deleteOldest});

          
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