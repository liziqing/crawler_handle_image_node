var winston = require('winston');

var urllib = require('urllib');

var logger = new (winston.Logger)({
    transports: [
      //new (winston.transports.Console)(),
      new (winston.transports.File)({ name: 'error-file', filename: 'error.log', level: 'error' }),
      //new (winston.transports.File)({ name: 'info-file', filename: 'info.log', level: 'info' })
    ]
});

var qiniu_base_url = "http://goods.cdnqiniu02.qnmami.com/";
//var qiniu_base_url = "http://7xlwqp.com2.z0.glb.qiniucdn.com/";

var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');

var qiniu = require('qiniu');

var configHandler = require("./confighandler");

var config = configHandler.getConfig();

var Queue = require('bee-queue');
var queue = Queue('crawler_handle_image', {
  prefix: 'bq',
  stallInterval: 5000,
  redis: {
    host: config['redis']['host'],
    port: config['redis']['port'],
    options: config['redis']['options']
  },
  removeOnSuccess: true
});
var concurrency = config['concurrency'];

qiniu.conf.ACCESS_KEY = config['qiniu']['access_key'];
qiniu.conf.SECRET_KEY = config['qiniu']['secret_key'];

var client = new qiniu.rs.Client();

var mongo_url = config["mongodb"]["url"];

// Use connect method to connect to the Server
MongoClient.connect(mongo_url, function(err, admin_db) {

  var db = admin_db.db('shiji_shop');

  logger.info("Connected correctly to server");

  queue.process(concurrency, function(job, cb) 
  {
  	// -> { "foo": { "bar": true }, "data": [10, 20] }
  	var type = job.data.t 

  	if(type == 'c'){
  		//color
  		var from_site = job.data.site;
  		var p_id = job.data.p_id;
  		var c_name = job.data.c_name;

      uploadColorImage(db, {'from_site': from_site, 'show_product_id': p_id, 'name': c_name}, from_site + "_" + p_id + "_" + c_name, cb);

  	}
    else if(type == 'c_r'){
      //color
      var from_site = job.data.site;
      var p_id = job.data.p_id;
      var c_name = job.data.c_name;

      uploadColorImageAgain(db, {'from_site': from_site, 'show_product_id': p_id, 'name': c_name}, from_site + "_" + p_id + "_" + c_name, cb);

    } 
    else if (type == 'i'){
  		//item
      var from_site = job.data.site;
      var p_id = job.data.p_id;

      uploadItemImage(db, {'from_site': from_site, 'show_product_id': p_id}, from_site + "_" + p_id, cb);      

  	}

  });
});

var uploadColorImageAgain = function(db, params, key, queue_cb) {
  // Get the documents collection
  var collection = db.collection('goods_colors');
  var goods_collection = db.collection('goods');
  // Find some documents
  collection.findOne(params, function(err, doc) {

    if (err) {
      return queue_cb(err)
    }

    var images = doc.images_bak;

    var success_count = 0;
    var update_start_count = images.length;
    var update_images = [];

    for (index in images)
    {
      update_images[index] = {}
      for (image_key in images[index])
      {
        update_images[index][image_key] = images[index][image_key]; 
      }
      
      update_images[index].image = qiniu_base_url + encodeURIComponent(key + "_" + index);
    }

    var update_params = {
      handle_image: 2,
      rehandle: '2',
      images: update_images
    }

    if (doc.cover_bak && doc.cover_bak != "")
    {
      update_start_count++;
      update_params.cover = qiniu_base_url + encodeURIComponent(key + "_cover");

      url = doc.cover_bak    

      qiniuUpload(url, "shiji-goods", key + "_cover", queue_cb, function(){
        success_count++;

        if(success_count == update_start_count)
        {
          collection.updateMany(params, {$set: update_params}, function(err, results){
            if (err)
            {
              return queue_cb(err);
            }

            return queue_cb();
          });  
        }
        
      });
    }

    var goods_params = {from_site: params['from_site'], show_product_id: params['show_product_id']};

    goods_collection.findOne(goods_params, function(err, doc) {

      if (err) {
        return queue_cb(err)
      }

      var goods_cover_url = doc.cover;
      
      for (index in images)
      {
        color_image = images[index];
        url = color_image.image;

        qiniuUpload(url, "shiji-goods", key + "_" + index, queue_cb, function(){

          logger.error(qiniu_base_url + encodeURIComponent(key + "_" + index));

          if((qiniu_base_url + encodeURIComponent(key + "_" + index)) == goods_cover_url){
            //进行替换cover_info的操作
            replaceGoodsCover(db, goods_cover_url, goods_params, queue_cb);
          }

          success_count++;

          if(success_count == update_start_count)
          {
            collection.updateMany(params, {$set: update_params}, function(err, results){
              if (err)
              {
                return queue_cb(err);
              }

              return queue_cb();
            });  
          }
          
        });
      }
      
    });

  });
}

var replaceGoodsCover = function(db, image_url, params, queue_cb) {

  var goods_collection = db.collection('goods');

  qiniuImageInfo(image_url, queue_cb, function(width, height){

    logger.error("width: "+ width + ",height: " + height);

    var cover_update_params = {"cover_info" : { "width" : width, "height" : height }};

    goods_collection.updateOne(params, {$set: cover_update_params}, function(err, results){
      if (err)
      {
        return queue_cb(err);            
      }

      return queue_cb();
    });

  });
  
}

var uploadColorImage = function(db, params, key, queue_cb) {
  // Get the documents collection
  var collection = db.collection('goods_colors');
  // Find some documents
  collection.findOne(params, function(err, doc) {

    if (err) {
      return queue_cb(err)
    }

  	var images = doc.images;

    var success_count = 0;
    var update_start_count = images.length;
    var update_images = [];

    for (index in images)
    {
      update_images[index] = {}
      for (image_key in images[index])
      {
        update_images[index][image_key] = images[index][image_key]; 
      }
      
      update_images[index].image = qiniu_base_url + encodeURIComponent(key + "_" + index);
    }

    var update_params = {
      handle_image: 2,
      images: update_images
    }

    if (doc.cover && doc.cover != "")
    {
      update_start_count++;
      update_params.cover = qiniu_base_url + encodeURIComponent(key + "_cover");

      url = doc.cover      

      qiniuUpload(url, "shiji-goods", key + "_cover", queue_cb, function(){
        success_count++;

        if(success_count == update_start_count)
        {
          collection.updateOne(params, {$set: update_params}, function(err, results){
            if (err)
            {
              return queue_cb(err);
            }

            return queue_cb();
          });  
        }
        
      });
    }

    for (index in images)
    {
      color_image = images[index];
      url = color_image.image;

      qiniuUpload(url, "shiji-goods", key + "_" + index, queue_cb, function(){
        success_count++;

        if(success_count == update_start_count)
        {
          collection.updateOne(params, {$set: update_params}, function(err, results){
            if (err)
            {
              return queue_cb(err);
            }

            return queue_cb();
          });  
        }
        
      });
    }
  });
}

var uploadItemImage = function(db, params, key, queue_cb) {
  // Get the documents collection
  var collection = db.collection('goods');
  // Find some documents
  collection.findOne(params, function(err, doc) {

    if (err) {
      return queue_cb(err)
    }

  	url = doc.cover;

    if(url){

      qiniuUpload(url, "shiji-goods", key, queue_cb, function(){
        collection.updateOne(params, {$set: {handle_image: 2, cover: qiniu_base_url + encodeURIComponent(key)}}, function(err, results){
          if (err)
          {
            return queue_cb(err);            
          }

          return queue_cb();
        });
      });  
    }else{
      return queue_cb();
    }
	  
  });
}

var qiniuImageInfo = function(image_url, queue_cb, success_callback)
{
  urllib.request(image_url + "?imageInfo", function (err, data, res) {
    if (err) {
      return queue_cb(err); // you need to handle error 
    }

    var dataJson = JSON.parse(data);
    var width = dataJson.width;
    var height = dataJson.height;

    success_callback(width, height);
  });
}

var qiniuUpload = function(url, bucket, key, queue_cb, success_callback, fail_callback)
{
    // client.stat(bucket, key, function(err, ret){
    //   if (!err)
    //   {
    //     //如果文件存在，则跳过
    //     queue_cb()
        
    //   } else{

        client.fetch(url, bucket, key, function(err, ret){
      
          if (!err) {
              // 上传成功， 处理返回值
              //console.log(ret);
              // ret.key & ret.hash
              
              success_callback();
          } else {
              // 上传失败， 处理返回代码
              logger.error(key + "--" + url + "--" + JSON.stringify(err));
              //return queue_cb(err);
              // http://developer.qiniu.com/docs/v6/api/reference/codes.html
              queue_cb(err);
          }
        });
    //   }
    // });
}