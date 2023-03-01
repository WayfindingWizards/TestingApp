import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useBLE from './useBLE';

const App = () => {
  const {requestPermissions, scanForPeripherals, location, rs1, rs2, rs3, dis1, dis2, dis3} = useBLE();
  const xCoord: number = location[0] as number;
  const yCoord: number = location[1] as number;

  const scanForDevices = () => {
    requestPermissions(isGranted => {
      if (isGranted) {
        scanForPeripherals();
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heartRateTitleWrapper}>
        {/* <Text style={{fontSize: 50, color: 'black'}}>Meters</Text>
        <Text style={{fontSize: 200, color: 'black'}}>{distance}</Text> */}
        {/* <Text style={{fontSize: 30, color: 'black'}}>Location</Text>
        <Text style={{fontSize: 100, color: 'black'}}>{xCoord}</Text>
        <Text style={{fontSize: 100, color: 'black'}}>{yCoord}</Text> */}
        <Text style={{fontSize: 30, color: 'black'}}>rssi</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{rs1}</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{rs2}</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{rs3}</Text>
        <Text style={{fontSize: 30, color: 'black'}}>distance</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{dis1.toFixed(2)}</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{dis2.toFixed(2)}</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{dis3.toFixed(2)}</Text>
        <Text style={{fontSize: 30, color: 'black'}}>location</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{xCoord.toFixed(2)}</Text>
        <Text style={{fontSize: 20, color: 'black'}}>{yCoord.toFixed(2)}</Text>
      </View>
      <TouchableOpacity onPress={scanForDevices} style={styles.ctaButton}>
        <Text style={styles.ctaButtonText}>FIND THE DISTANCE</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  heartRateTitleWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartRateTitleText: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 20,
    color: 'black',
  },
  heartRateText: {
    fontSize: 25,
    marginTop: 15,
  },
  ctaButton: {
    backgroundColor: 'purple',
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    marginHorizontal: 20,
    marginBottom: 5,
    borderRadius: 8,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default App;