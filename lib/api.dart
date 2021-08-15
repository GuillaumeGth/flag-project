
import 'dart:convert';
import 'dart:io';

enum HttpMethod {
  Get,
  Post,
}

class Api {
  static Future<HttpClientResponse> Query(String path, {HttpMethod method = HttpMethod.Get, Object? postData}) async{
    HttpClient client = HttpClient();
    client.badCertificateCallback = ((X509Certificate cert, String host, int port) => true);
    Uri uri = Uri.parse('https://10.0.2.2:5001/' + path);
    HttpClientRequest request;
    if (method == HttpMethod.Get){
       request = await client.getUrl(uri);
    }
    else {
      request = await client.postUrl(uri);
      request.headers.set('Content-type', 'application/json');
      request.write(json.encode(postData));
    }
    HttpClientResponse response = await request.close();
    return response;
  }
}