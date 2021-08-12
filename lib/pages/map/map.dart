import 'dart:async';
import 'dart:typed_data';
import 'dart:ui';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_project/components/appBar/app_bar.dart';
import 'package:flutter_project/components/menu/menu.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:ansicolor/ansicolor.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:location/location.dart';

class FlagMap extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}
class Logger{
  static log(msg) {
    AnsiPen pen = new AnsiPen()..red();
    print(pen('$msg'));
  }
}
class _MyAppState extends State<FlagMap> {
  late String _mapStyle;
  late LatLng _center;
  late Location _locationTracker = Location();
  late GoogleMapController mapController;
  Completer<GoogleMapController> _controller = Completer();
  Marker? marker;
  late Circle circle;
  late BitmapDescriptor bitmapDescriptor;

  void _onMapCreated(GoogleMapController controller) {
    _controller.complete(controller);
    //mapController = controller;
    controller.setMapStyle(_mapStyle);
    getLocation();
  }

  initMap() async {
    if (await Permission.location
        .request()
        .isGranted) {
      loadStyle();
      _locationTracker.getLocation().then((location) {
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

  LocationDataToLatLtn(LocationData location) {
    return LatLng(location.latitude as double, location.longitude as double);
  }

  GetCurrentLatLng() {
    _locationTracker.getLocation().then((location) {
      LatLng latLng = LocationDataToLatLtn(location);
      return latLng;
    });
  }

  getLocation() async {
    final GoogleMapController controller = await _controller.future;
    _locationTracker.onLocationChanged.listen((newLocalData) {
      print("new location");
      LatLng latLng = LocationDataToLatLtn(newLocalData);
      controller.animateCamera(
          CameraUpdate.newCameraPosition(CameraPosition(
              target: latLng,
              tilt: 0
          )));
      updateMarker(LocationDataToLatLtn(newLocalData));
    });
  }

  updateMarker(LatLng latLng) async {
    var bytes;
    String? photoUrl = FirebaseAuth.instance.currentUser?.photoURL;
    if (photoUrl != null){
      final markerImageFile = await DefaultCacheManager().getSingleFile(photoUrl);
      Image img = Image.file(markerImageFile, width: 20,);
      final Uint8List markerImageBytes = await markerImageFile.readAsBytes();
      bytes = markerImageBytes;//request.bodyBytes;
    }
    BitmapDescriptor bitmapDescriptor2 = await BitmapDescriptor.fromAssetImage(ImageConfiguration(size: Size(500, 500)), 'assets/images/marker.png');
    print(bitmapDescriptor2);
    this.setState(() {
      bitmapDescriptor = BitmapDescriptor.fromBytes(bytes.buffer.asUint8List());
      marker = Marker(
          markerId: MarkerId("pointerMarker"),
          position: latLng,
          draggable: false,
          zIndex: 2,
          flat: true,
          icon: bitmapDescriptor2,
          anchor: Offset(0.5, 0.5));

      /*marker = Marker(
          markerId: MarkerId("userMarker"),
          position: latLng,
          draggable: false,
          zIndex: 2,
          flat: true,
          icon: bitmapDescriptor,
          anchor: Offset(0.5, 0.5));*/
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
  void dispose() {
    disposeMap();
    super.dispose();
  }
  void disposeMap() async {
    final GoogleMapController controller = await _controller.future;
    controller.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget w = GoogleMap(
      markers: Set.of([marker as Marker]),
      circles: Set.of([circle]),
      zoomControlsEnabled: false,
      scrollGesturesEnabled: false,
      mapType: MapType.normal,
      zoomGesturesEnabled: false,
      minMaxZoomPreference: MinMaxZoomPreference(17, 19),
      onMapCreated: _onMapCreated,
      initialCameraPosition: CameraPosition(
        target: _center,
        zoom: 18.0,
      ),
    );
    return
    SafeArea(top: false,
        child: Scaffold(
          endDrawer: Menu(),
          appBar: CustomAppBar(),
          body: w,
          floatingActionButton: FloatingActionButton(
              child: Icon(Icons.add),
              onPressed: () {
                Navigator.pushNamed(context, '/message');
              })
      ))
      ;
  }
}
