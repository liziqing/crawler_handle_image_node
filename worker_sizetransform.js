var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
//      new (winston.transports.Console)(),
      new (winston.transports.File)({ name: 'error-file', filename: 'error_sizetransform.log', level: 'error' }),
      new (winston.transports.File)({ name: 'info-file', filename: 'info_sizetransform.log', level: 'info' })
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
var concurrency = 1;//config['concurrency'];

var mongo_url = config["mongodb"]["url"];

//Use connect method to connect to the Server
var count_succ = 0;
var count_err = 0;
MongoClient.connect(mongo_url, 
	{replset:{poolSize:100}},
	function(err, admin_db) {
	  var db = admin_db.db('shiji_shop');

	  logger.info("Connected correctly to server");

	  queue.process(concurrency, function(job, cb) 
	  {
  		var site = job.data.site;
  		var size = job.data.size;
  		var s_z = job.data.s_z;
  		var s_t = job.data.s_t;
  		updateSize(db, {'from_site': site, 'size': size}, {'s_z': s_z, 's_t': s_t}, cb);
	  });
	  });
	  

var updateSize = function(db, findParams, updParams, queue_cb){
	var collection = db.collection('skus');
	collection.update(findParams,{$set: updParams}, {multi: true},function(err, doc)
	{
		logger.info('updating size', findParams, updParams)
	    if (err) {
	    	count_err++;
	    	logger.error('!!Failed---- num err', count_err, '----', findParams, '----', JSON.stringify(err))
	        return queue_cb(err);
	      }
	    else{
			count_succ++;
	    	logger.info('Succeed---- num succ', count_succ, '----', findParams, '----', updParams)
	    }
	    return queue_cb();
	}
	);
}