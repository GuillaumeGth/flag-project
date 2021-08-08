import 'package:flutter/material.dart';
class AppBarComponent extends StatelessWidget implements PreferredSizeWidget {
  final double height = 50;

  @override
  // TODO: implement preferredSize
  Size get preferredSize => Size(100, 50);

  @override
  Widget build(BuildContext context) {
    return AppBar(
        title: Image.asset("assets/images/logo2.png", width: 40, height: 60, alignment: Alignment.bottomCenter,),
        //backgroundColor: Colors.green[700],
        actions: <Widget>[
          IconButton(
            iconSize: 45,
            icon: const Icon(Icons.menu),
            onPressed: () {},
          )]
    );
  }
}