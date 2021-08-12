import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

class Menu extends StatefulWidget {
  Menu({String? key, User? user}) : super(key: Key(key ?? "anonymous" + "Menu")) {
    print("creating Menu");
    this._currentUser = user;
  }
  User? _currentUser;
  @override
  _CustomMenuState createState() => _CustomMenuState(user: _currentUser);
}

class _CustomMenuState extends State<Menu>{
  _CustomMenuState({User? user}) : super() {
    this._currentUser = user;
    print("creating menu");
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
    String displayedName = _currentUser?.email ?? "";
    return Drawer(

        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(color: Colors.blue,),
              child: Text(displayedName),
              ),
            ListTile(
                title: const Text('Messages'),
                leading: Icon(Icons.email),
                onTap: () {
                  GoTo('messages');
                },
              ),
            ListTile(
              title: const Text('Account'),
              onTap: () {
                // Update the state of the app.
                // ...
              },
            ),
            ListTile(
              title: const Text('Sign Out'),
              onTap: () {
                GoogleSignIn().signOut();
                FirebaseAuth.instance.signOut();
                GoTo('');
              },
            ),
            ],
        ),
      );
  }
  GoTo(page){
    Navigator.of(context).pop();
    Navigator.pushNamed(context, '/' + page);
  }
}