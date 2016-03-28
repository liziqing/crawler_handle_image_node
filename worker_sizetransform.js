var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
//      new (winston.transports.Console)(),
      new (winston.transports.File)({ name: 'error-file', filename: 'error_sizetransform.log', level: 'error' }),
//      new (winston.transports.File)({ name: 'info-file', filename: 'info_sizetransform.log', level: 'info' })
    ]
});
var MongoClient = require('mongodb').MongoClient
, assert = require('assert');

var configHandler = require("./confighandler");

var config = configHandler.getConfig();

var Queue = require('bee-queue');
var queue = Queue('size_transform', {
  prefix: 'bq',
  stallInterval: 5000,
  redis: {
    host: config['redis']['host'],
    port: config['redis']['port'],
    options: config['redis']['options']
  },
  removeOnSuccess: true
});
var concurrency = 1//config['concurrency'];

var mongo_url = config["mongodb"]["url"];
if (mongo_url.match(/\?/)){
	mongo_url += '&maxPoolSize=100&w=1&socketTimeoutMS=30000'
}
else{
	mongo_url += '?maxPoolSize=100&w=1&socketTimeoutMS=30000'
}
//Use connect method to connect to the Server
var count_succ = 0;
var count_err = 0;
MongoClient.connect(mongo_url, function(err, admin_db) {
	  var db = admin_db.db('shiji_shop');

	  logger.info("Connected correctly to server");

	  queue.process(concurrency, function(job, cb) 
	  {
  		var site = job.data.site;
  		var size = job.data.size;
  		var s_z = job.data.s_z;
  		var s_t = job.data.s_t;
  		updateSize(db, {'from_site': site, 'size': size, 's_z': {'$exists': false}}, {'s_z': s_z, 's_t': s_t}, cb);
	  });
	  });
	  

var updateSize = function(db, findParams, updParams, queue_cb){
	var collection = db.collection('skus');
	collection.update(findParams,{$set: updParams}, {multi: true},function(err, doc)
	{
		logger.info('updating size', findParams, updParams)
	    if (err) {
	    	count_err++;
	    	logger.error('Failed---- num err', count_err, '----', findParams, '----', JSON.stringify(err))
	        return queue_cb(err);
	      }
	    else{
			count_succ++;
	    	logger.error('Succeed---- num succ', count_succ, '----', findParams, '----', JSON.stringify(err))
	    }
//	    logger.error(doc)
	    return queue_cb();
	}
	);
}