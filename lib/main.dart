import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_datastore/amplify_datastore.dart';
import 'package:amplify_flutter/amplify.dart';
import 'package:firebase_auth/firebase_auth.dart' as FirebaseAuth;
import 'package:flutter/material.dart';
import 'package:flutter_project/pages/map/map.dart';
import 'package:flutter_project/pages/messages/message.dart';
import 'package:flutter_project/pages/messages/messages.dart';
import './pages/login/login.dart';
import 'package:firebase_core/firebase_core.dart';
import 'components/appBar/app_bar.dart';

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
  FirebaseAuth.User? _currentUser;
  CustomAppBar AppBar = CustomAppBar();

  @override
  void initState() {
    super.initState();
  }
  refresh(){
    setState(() {
      _currentUser = FirebaseAuth.FirebaseAuth.instance.currentUser;
      AppBar = CustomAppBar(key: _currentUser?.email, user: _currentUser,);
    });
  }
  getInitialRoute(){
    if (FirebaseAuth.FirebaseAuth.instance.currentUser == null){
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