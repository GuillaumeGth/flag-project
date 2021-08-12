import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_project/pages/map/map.dart';
import 'package:flutter_project/pages/messages/message.dart';
import 'package:flutter_project/pages/messages/messages.dart';
import './pages/login/login.dart';
import 'package:firebase_core/firebase_core.dart';

import 'components/appBar/app_bar.dart';
import 'components/menu/menu.dart';
void main ()/**/ async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(App());
}

class App extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}
class _MyAppState extends State<App> {
  User? _currentUser;
  CustomAppBar AppBar = CustomAppBar();

  refresh(){
    setState(() {
      _currentUser = FirebaseAuth.instance.currentUser;
      AppBar = CustomAppBar(key: _currentUser?.email, user: _currentUser,);
    });
  }
  getInitialRoute(){
    if (FirebaseAuth.instance.currentUser == null){
      print("get route");
      print(_currentUser);
      return '/';
    }
    return '/map';
  }
  @override
  Widget build(BuildContext context) {
    String displayedName = _currentUser?.email ?? "";
    return MaterialApp(
        initialRoute: getInitialRoute(),
        routes: {
          // When navigating to the "/" route, build the FirstScreen widget.
          '/': (context) => SignInScreen(refresh),
          // When navigating to the "/second" route, build the SecondScreen widget.
          '/map': (context) => FlagMap(),
          '/messages': (context) => Messages(),
          '/message': (context) => Message(),
        }
    );
  }
  Widget GetBodyWidget(){
    print("GetBodyWidget");
    print(_currentUser);
    if (_currentUser == null){
      return SignInScreen(refresh);
    }
    return FlagMap();
  }
  void rebuildAllChildren(BuildContext context) {
    void rebuild(Element el) {
      el.markNeedsBuild();
      el.visitChildren(rebuild);
    }
    (context as Element).visitChildren(rebuild);
  }
}