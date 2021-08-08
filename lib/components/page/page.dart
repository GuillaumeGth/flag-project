import 'package:flutter/material.dart';
import '../appBar/app_bar.dart';

class PageComponent extends StatelessWidget {
  late var body;
  late var floating;
  PageComponent(body, floating){
    this.body = body;
    this.floating = floating;

  }
  @override
  Widget build(BuildContext context) => MaterialApp(
      home: Scaffold(
        appBar: AppBarComponent(),
        body: body,
        floatingActionButton: floating,
      )
  );
}
