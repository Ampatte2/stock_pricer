/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var fetch = require("node-fetch");

const CONNECTION_STRING = "mongodb+srv://Ampatte2:Roflpwn123@stock-price-checker-2psfn.mongodb.net/admin?retryWrites=true&w=majority"; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

module.exports = function (app, db) {
  
  
      
      app.route('/api/stock-prices')
    .get(function (req, res){
        MongoClient.connect(CONNECTION_STRING, function(err, db){
    if (err){
      console.log(err);
    }else{
      console.log("Connected")
      var database = db.db("test");
      var collection = database.collection("stocks");
      
      const query = {
        stock: req.query.stock,
        like: req.query.like ? 1:0,
        ip: req.headers["x-forwarded-for"].split(",")[0]
      };
     
      if (!query.stock){
        res.redirect("/");
      }
        
        if(typeof query.stock == "string" && query.stock.length<2){
          fetch('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + query.stock + '&apikey=${TXW1EFAOJQR1C4LN}')
            .then(data=>data.json())
            .catch(err=> console.log(err))
            .then(data=>{
            console.log(data);
            const stock = {
              symbol: data["Global Quote"]["01. symbol"],
              price: data["Global Quote"]["05. price"]
            }
            collection.findOne({symbol: stock.symbol}, (err, doc)=>{
              if (err){console.log(err)}
              else{
                const allowLike = !(doc && doc.ip && doc.ip.includes(query.ip));
                
                collection.findAndModify(
                  {symbol:stock.symbol},{},
                  {$setOnInsert:{symbol:stock.symbol, price:stock.price}, $set:{last_update: new Date()}, $addToSet:{ip:query.like && query.ip}, $inc:{likes:(query.like && allowLike)? 1:0}},
                  {upsert:true, new:true}, (err, doc)=>{
                    if (err){console.log(err)}
                    else{
                      res.json({stockData: {stock: doc.value.symbol, price: doc.value.price, likes: doc.value.likes}});
                    }
                  }
                );
              }
            })
            
          }).catch(err => {console.log(err)})
        }else{
          const stocksPromise = [];
          
          
          query.stock.map(stock=> stocksPromise.push(fetch('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + stock + '&apikey=${TXW1EFAOJQR1C4LN}')));
          
          Promise.all(stocksPromise)
            .then((res, i)=>{
            const jsonPromise=[];
            res.map(res => jsonPromise.push(res.json()));
            return Promise.all(jsonPromise)
          })
          .catch(err=> {console.log(err)})
          .then((data)=>{
            console.log(data)
            const stocks = data.map(data=>(
              {
              symbol: data["Global Quote"]["01. symbol"],
              price: data["Global Quote"]["05. price"],
              like: query.like ? 1:0,
              likes:0
            }))
            stocks.map((stock, i)=>{
              collection.findOne({symbol: stock.symbol}, (err, doc)=>{
                if(err){console.log(err)}
                else{
                  const allowLike = !(doc && doc.ip && doc.ip.includes(query.ip));
                  collection.findAndModify(
                  {symbol:stock.symbol},{},
                  {$setOnInsert:{symbol:stock.symbol, price:stock.price}, $set:{last_update: new Date()}, $addToSet:{ip: query.like && query.ip}, $inc:{likes: (stock.like && allowLike)? 1:0}},
                    {upsert:true, new:true},
                    (err,doc) =>{
                      if (err){console.log(err)}
                      else{
                        stocks[i].likes = doc.value.likes;
                        if (i== stocks.length-1){
                          const response={};
                          response.stockData = stocks.map((stock, i)=>({
                            stock: stock.symbol, price: stock.price, rel_likes: stock.likes - stocks[(i+1)%2].likes
                          }));
                          res.json(response);
                        }
                      }
                    }
                  )
                }
              })
            })
          }).catch(err=>{console.log(err)});
        }
    }}) } );
    
  
  
    
};
