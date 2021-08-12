import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_project/components/appBar/app_bar.dart';
import 'package:flutter_project/components/menu/menu.dart';

class Messages extends StatefulWidget {
  @override
  _MessagesState createState() => _MessagesState();
}

class _MessagesState extends State<Messages> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      endDrawer: Menu(),
      appBar: CustomAppBar(),
      body: ListView.separated(
        separatorBuilder: (context, index) => Divider(
          color: Colors.black,
        ),
        itemCount: 10,
        itemBuilder: (context, index) {
          return GestureDetector(
            child: Padding(
              padding: EdgeInsets.all(20.0),
              child: Center(child: Text("Message $index"),),
            ),
            onTap: () {
              Navigator.pushNamed(context, '/message');
            }
          );
        }

            ,
      ),
        floatingActionButton: FloatingActionButton(
            child: Icon(Icons.send),
            onPressed: () {
              Navigator.pushNamed(context, '/message');
            })
    );
  }

}