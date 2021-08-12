import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class CustomAppBar extends StatefulWidget implements PreferredSizeWidget {
  //CustomAppBar({required Key key,}) : preferredSize = Size.fromHeight(kToolbarHeight), super(key: Key("appBar"));
  CustomAppBar({String? key, User? user}) : super(key: Key(key ?? "anonymous" + "appBar")) {
    print("creating CustomAppBar");
    this._currentUser = user;
  }
  User? _currentUser;
  @override
  final Size preferredSize = Size.fromHeight(kToolbarHeight);// default is 56.0

  @override
  _CustomAppBarState createState() => _CustomAppBarState(user: _currentUser);
}

class _CustomAppBarState extends State<CustomAppBar>{
  _CustomAppBarState({User? user}) : super() {
    this._currentUser = user;
    print("creating appbar");
  }
  User? _currentUser;
  void initState() {
    super.initState();
    setState(() {
      _currentUser = FirebaseAuth.instance.currentUser;
    });
  }

  @override
  Widget build(BuildContext context) {
    print("printing appbar");
    print(_currentUser);
    return AppBar(
      title: Image.asset("assets/images/logo2.png", width: 40, height: 60, alignment: Alignment.bottomCenter,),
      automaticallyImplyLeading: false,
      actions: <Widget>[
        IconButton(
          iconSize: 45,
          icon: const Icon(Icons.menu),
          onPressed: () {
            Scaffold.of(context).openEndDrawer();
          },
        )],
        );
  }
}