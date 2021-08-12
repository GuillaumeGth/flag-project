import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_project/components/appBar/app_bar.dart';
import 'package:flutter_project/components/menu/menu.dart';

class Message extends StatefulWidget {
  @override
  _MessageState createState() => _MessageState();
}

class _MessageState extends State<Message> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
        endDrawer: Menu(),
        appBar: CustomAppBar(),
    );
  }

}