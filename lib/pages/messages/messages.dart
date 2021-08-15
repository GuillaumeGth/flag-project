import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_project/components/appBar/app_bar.dart';
import 'package:flutter_project/components/menu/menu.dart';
import 'package:flutter_project/models/chatUserModel.dart';
import '../../api.dart';
import 'conversationList.dart';

class Messages extends StatefulWidget {
  @override
  _MessagesState createState() => _MessagesState();
}

class _MessagesState extends State<Messages> {
  List<ChatUsers> chatUsers = [
    ChatUsers(name: "Anna Dolidze", messageText: "<3", time: "Now"),
    ChatUsers(name: "Yahya El Adib", messageText: "tu penses qu'on peut se definir par son art ? ", time: "3 min ago"),
    ChatUsers(name: "Bastos Locos", messageText: "Apero ?", time: "Now"),
    ChatUsers(name: "Ivan Figoni", messageText: "t'as pas vu mon nez ?", time: "Now"),
    ChatUsers(name: "Elias", messageText: "tu veux manger libanais ?", time: "Now"),
  ];
  SearchInputChanged(text)
  async {
    var result =  await Api.Query('User/list', method: HttpMethod.Post, postData: {
      "query": text,
    });
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      endDrawer: Menu(),
      appBar: CustomAppBar(),
      body: Column(
          children: [Padding(
            padding: EdgeInsets.only(top: 16,left: 16,right: 16),
            child: TextField(
              onChanged: SearchInputChanged,
              decoration: InputDecoration(
                hintText: "Search...",
                hintStyle: TextStyle(color: Colors.grey.shade600),
                prefixIcon: Icon(Icons.search,color: Colors.grey.shade600, size: 20,),
                filled: true,
                fillColor: Colors.grey.shade100,
                contentPadding: EdgeInsets.all(8),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide(
                        color: Colors.grey.shade100
                    )
                ),
              ),
            ),
          ),
            ListView.builder(
              itemCount: chatUsers.length,
              shrinkWrap: true,
              padding: EdgeInsets.only(top: 16),
              physics: NeverScrollableScrollPhysics(),
              itemBuilder: (context, index){
                return ConversationListItem(
                  name: chatUsers[index].name,
                  messageText: chatUsers[index].messageText,
                  time: chatUsers[index].time,
                  isMessageRead: (index == 0 || index == 3)?true:false,
                );
              },
            ),
          ]
        ),
        floatingActionButton: FloatingActionButton(
            child: Icon(Icons.send),
            onPressed: () {
              Navigator.pushNamed(context, '/message');
            })
    );
  }

}