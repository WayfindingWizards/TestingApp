import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import BleManager from 'react-native-ble-manager';

const BeaconDistance = () => {
  const [beaconDistances, setBeaconDistances] = useState({});

  // Define the calibrated TX power for each beacon
  const txPowers = {
      'fda50693a4e24fb1afcfc6eb07647825': -27.5, // calibrated TX power for beacon 1
      '00000000000000000000000000000000': -33.5, // calibrated TX power for beacon 2
      'fda50693a4e24fb1afcfc6eb07647826': -30, // calibrated TX power for beacon 3
  };

  // Define the function to handle device discovery
  const onDeviceFound = (device) => {
    // Get the UUID and signal strength of the device
    const uuid = device.id;
    const rssi = device.rssi;

    // Calculate the distance to the device based on the signal strength and calibrated TX power
    const txPower = txPowers[uuid];
    const ratio = rssi * 1.0 / txPower;
    let distance;
    if (ratio < 1.0) {
      distance = Math.pow(ratio, 10);
    } else {
      distance = (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
    }

    // Update the state with the estimated distance to the device
    setBeaconDistances(prevState => ({
      ...prevState,
      [uuid]: distance.toFixed(2),
    }));
  };

  useEffect(() => {
    BleManager.start({ showAlert: false })
      .then(() => {
        // Listen for BLE advertisements
        BleManager.on('BleManagerDiscoverPeripheral', onDeviceFound);
      })
      .catch(error => {
        console.error(error);
      });

    return () => {
      BleManager.stopScan();
      BleManager.removeListener('BleManagerDiscoverPeripheral', onDeviceFound);
    };
  }, []);

  return (
    <View>
      {Object.entries(beaconDistances).map(([uuid, distance]) => (
        <Text key={uuid}>Distance to {uuid}: {distance} meters</Text>
      ))}
    </View>
  );
};

export default BeaconDistance;