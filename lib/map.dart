import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:ansicolor/ansicolor.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

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
  late String _mapStyle;
  late LatLng? _center;
  late Position position;
  late GoogleMapController mapController;

  void _onMapCreated(GoogleMapController controller) {
    print("gza");
    mapController = controller;
    print(_mapStyle);
    mapController.setMapStyle(_mapStyle);
  }
  @override
  void initState() {
    super.initState();
    loadStyle();
    getLocation();
  }
  loadStyle() async {
    await rootBundle.loadString('assets/styles/map_style.txt').then((string) {
        setState(() {
          _mapStyle = string;
        });
      });
  }
  getLocation () async {
    if (await Permission.location.request().isGranted) {
      position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _center = LatLng(position.latitude, position.longitude);
      });
    }
  }
  @override
  void dispose(){
    mapController.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    List<Marker> customMarkers = [];
    Marker m = Marker(
        markerId: MarkerId("UserMarker"),
        position: _center as LatLng
    );
    customMarkers.add(m);
    Widget w;
    if (_center == null){
      w = Text("Loading");
    }
    else {
      print(_center);
      w = GoogleMap(
        markers: customMarkers.toSet(),
        zoomControlsEnabled: false,
        scrollGesturesEnabled: false,
        mapType: MapType.normal,
        minMaxZoomPreference: MinMaxZoomPreference(17, 19),
        onMapCreated: _onMapCreated,
        initialCameraPosition: CameraPosition(
          target: _center as LatLng,
          zoom: 18.0,
        ),
      );
    }
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(
          title: Text('Fläg'),
          backgroundColor: Colors.green[700],
            actions: <Widget>[
              IconButton(
                iconSize: 45,
                icon: const Icon(Icons.menu),
                onPressed: () {},
              )]
        ),
        body: w
      ),
    );
  }
}