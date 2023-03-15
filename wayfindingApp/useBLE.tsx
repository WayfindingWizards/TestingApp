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

// this needs to be reset every 'period' we want to update location
  //find max value -> update location -> reset beaconSignals
let beaconSignals = new Array<number>(6); // beaconSignals is an array where beaconSignals[beaconNum] = rssi

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
          const deviceRssi = device.rssi!;
          const deviceID = device.id;
          let beaconNum: number;

          // Match deviceID to beacon and put signal in array
          switch (deviceID){
            case 'DC:0D:30:10:4E:F2': //Feasy1
              beaconNum = 0;
              beaconSignals[beaconNum] = deviceRssi;
              console.log(beaconNum);
              break;
            case 'DC:0D:30:10:4F:57': //Feasy2
              beaconNum = 1;
              beaconSignals[beaconNum] = deviceRssi;
              console.log(beaconNum);
              break;
            case 'DC:0D:30:10:4F:3D': //Feasy3
              beaconNum = 2;
              beaconSignals[beaconNum] = deviceRssi;
              console.log(beaconNum);
              break;
            case 'DD:60:03:00:02:C0': //BC1
              beaconNum = 3;
              beaconSignals[beaconNum] = deviceRssi;
              console.log(beaconNum);
              break;
            case 'DD:60:03:00:03:3C': //BC2
              beaconNum = 4;
              beaconSignals[beaconNum] = deviceRssi;
              console.log(beaconNum);
              break;
            case 'DD:60:03:00:00:4F': //BC3
              beaconNum = 5;
              beaconSignals[beaconNum] = deviceRssi;
              console.log(beaconNum);
              break;
          }

          console.log(beaconSignals);
          
          //this is wrong and for testing purposes
          setclosestBeacon(beaconSignals.indexOf(beaconSignals.reduce((a, b) => Math.max(a, b), -Infinity)));
          
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