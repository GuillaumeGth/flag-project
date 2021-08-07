import 'dart:async';
import 'dart:developer';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:ansicolor/ansicolor.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:location/location.dart';
void main() => runApp(MyApp());

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}
class Logger{
  static log(msg) {
    AnsiPen pen = new AnsiPen()..red();
    print(pen('$msg'));
  }
}
class _MyAppState extends State<MyApp> {
  late StreamSubscription _locationSubscription;
  late String _mapStyle;
  late LatLng _center;
  late Location _locationTracker = Location();
  late GoogleMapController mapController;
  late Marker marker;
  late Circle circle;
  void _onMapCreated(GoogleMapController controller) {
    mapController = controller;
    mapController.setMapStyle(_mapStyle);
    getLocation();
  }
  initMap() async {
    if (await Permission.location.request().isGranted) {
      loadStyle();
      _locationTracker.getLocation().then((location){
        LatLng c = LocationDataToLatLtn(location);
        setState(() {
          _center = c;
          updateMarker(_center);
        });
      });
    }
  }
  @override
  void initState() {
    super.initState();
    initMap();
  }
  loadStyle() async {
    await rootBundle.loadString('assets/styles/map_style.txt').then((string) {
        setState(() {
          _mapStyle = string;
        });
      });
  }
  LocationDataToLatLtn (LocationData location){
    return LatLng(location.latitude as double, location.longitude as double);
  }
  GetCurrentLatLng() {
    _locationTracker.getLocation().then((location){
      LatLng latLng = LocationDataToLatLtn(location);
      return latLng;
    });
  }
  getLocation () async {
    LatLng latLng = await _locationTracker.getLocation().then((location){
      LatLng latLng = LocationDataToLatLtn(location);
      return latLng;
    });
    setState(() {
      _center = latLng;
    });
    _locationSubscription = _locationTracker.onLocationChanged.listen((newLocalData) {
      print("new location");
      mapController.animateCamera(
          CameraUpdate.newCameraPosition(new CameraPosition(
              target: latLng,
              tilt: 0
          )));
          updateMarker(LocationDataToLatLtn(newLocalData));
    });
  }
  void updateMarker(LatLng latLng) {
    this.setState(() {
      marker = Marker(
          markerId: MarkerId("userMarker"),
          position: latLng,
          draggable: false,
          zIndex: 2,
          flat: true,
          anchor: Offset(0.5, 0.5));
      circle = Circle(
          circleId: CircleId("perimeter"),
          radius: 50,
          zIndex: 1,
          strokeColor: Colors.blue,
          strokeWidth: 2,
          center: latLng,
          fillColor: Colors.blue.withAlpha(70));
    });
  }
  @override
  void dispose(){
    mapController.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    Widget w;
    if (_center == null){
      w = Text("Loading");
    }
    else {
      print(_center);
      w = GoogleMap(
        markers: Set.of([marker]),
        circles: Set.of([circle]),
        zoomControlsEnabled: false,
        scrollGesturesEnabled: false,
        mapType: MapType.normal,
        minMaxZoomPreference: MinMaxZoomPreference(17, 19),
        onMapCreated: _onMapCreated,
        initialCameraPosition: CameraPosition(
          target: _center,
          zoom: 18.0,
        ),
      );
    }
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(
          title: Image.asset("assets/images/logo2.png", width: 40, height: 60, alignment: Alignment.bottomCenter,),
          //backgroundColor: Colors.green[700],
            actions: <Widget>[
              IconButton(
                iconSize: 45,
                icon: const Icon(Icons.menu),
                onPressed: () {},
              )]
        ),
        body: w,
        floatingActionButton: FloatingActionButton(
            child: Icon(Icons.add),
            onPressed: () {

            })
      ),
    );
  }
}