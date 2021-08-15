import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart' as FirebaseAuth;
import 'package:flutter/material.dart';
import 'package:flutter_project/components/appBar/app_bar.dart';
import 'package:flutter_project/components/menu/menu.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../api.dart';

class SignInScreen extends StatefulWidget {
  final void Function() callback;
  SignInScreen(this.callback);
  @override
  State createState() => SignInState(this.callback);
}

class SignInState extends State<SignInScreen> {
  final void Function() callback;
  SignInState(this.callback);
  FirebaseAuth.User? _currentUser;
  String _contactText = '';
  final GoogleSignIn googleSignIn = new GoogleSignIn();

  get newPost => null;
  void _handleSignIn() async {
    await googleSignIn.signOut();
    // Trigger the authentication flow
    final GoogleSignInAccount? googleUser = await googleSignIn.signIn();

    // Obtain the auth details from the request
    final GoogleSignInAuthentication googleAuth = await googleUser!.authentication;
    // Create a new credential
    final credential = FirebaseAuth.GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    await FirebaseAuth.FirebaseAuth.instance.signInWithCredential(credential);
    setState(() {
      _currentUser = FirebaseAuth.FirebaseAuth.instance.currentUser;
    });
    callback();
    UpdateUser();
    Navigator.pushNamed(context, '/map');
  }
  Future<HttpClientResponse> UpdateUser() async {
    var user = FirebaseAuth.FirebaseAuth.instance.currentUser;
    return await Api.Query('User', method: HttpMethod.Post, postData: {
      "email": user?.email,
      "name": user?.displayName
    });

    HttpClient client = HttpClient();
    client.badCertificateCallback = ((X509Certificate cert, String host, int port) => true);;
    HttpClientRequest request = await client.postUrl(Uri.parse('https://10.0.2.2:5001/User'));
    request.headers.set('Content-type', 'application/json');
    request.write(json.encode(
        {
          "email": user?.email,
          "name": user?.displayName
        }));
    HttpClientResponse response = await request.close();
    return response;
  }
  _handleSignOut() async {
    await FirebaseAuth.FirebaseAuth.instance.signOut();
    await googleSignIn.signOut();
    setState(() {
      _currentUser = FirebaseAuth.FirebaseAuth.instance.currentUser;
    });
    callback();
  }
  Widget _buildBody() {
    if (_currentUser != null) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: <Widget>[
          Text(_currentUser?.displayName ?? ""),
          const Text("Signed in successfully."),
          Text(_contactText),
          ElevatedButton(
            child: const Text('SIGN OUT'),
            onPressed: _handleSignOut,
          ),
        ],
      );
    } else {
      return Column(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: <Widget>[
          const Text("You are not currently signed in."),
          ElevatedButton(
            child: const Text('SIGN IN'),
            onPressed: _handleSignIn,
          ),
        ],
      );
    }
  }
  @override
  Widget build(BuildContext context) {
    return  Scaffold(
        appBar: CustomAppBar(),
        endDrawer: Menu(),
        body: _buildBody(),
      );
  }
}

