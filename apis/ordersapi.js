const express = require("express");
const orderRouter = express.Router();
const _ = require("lodash");
const {Order, orderValidation, orderValidationfirst} = require("../modals/order");
const asyncMiddleware = require("../middlewares/asyncerrorhandler")
const {Area} = require("../modals/area")
const {Store} = require("../modals/store");
const {DeliveryWorker} = require("../modals/deliveryWorker")
const geolib = require('geolib');
const sortObjectsArray = require('sort-objects-array');
const { Product } = require("../modals/product");



orderRouter.put("/orderpackaged/:id", async (req, res)=>{

       let order = await Order.findById({_id: req.params.id})
       
       order.status = "packaged"

       order = await order.save();

       return res.send(order);

});

orderRouter.put("/orderdelivered/:id", async (req, res)=>{

    let order = await Order.findById({_id: req.params.id})
    
    order.status = "delivered"

    order = await order.save();

    return res.send(order);

});



orderRouter.post("/placeorder",  async(req, res)=>{
 

       const {error} =  orderValidationfirst(req.body);

       if(error) {
           return res.status(400).send(error);
       }

       const areas = await Area.find()
       const stores = await Store.find().select("-password")
       const products = await Product.find();
       

       var selectedStore = "";
       var selectedArea = "";
       var selectedDeliveryWorker = "";
       var rad = 200


       for (var i = 0; i < stores.length; i++) {
           console.log(i)
        var object = stores[i];

        var dist = geolib.isPointWithinRadius(

            { latitude: object.location.lat, longitude: object.location.long },
            { latitude: req.body.customer.location.lat, longitude: req.body.customer.location.long},
            rad
        );
        
        if(dist)
        {
            
            console.log("Connected to store: " + object.storeName);
            selectedStore = object;
            break;
        }

        if(!dist)
        {
            if ( i == stores.length -1)
            {
                if (rad >= 2000)
                {
                    console.log("not is range")
                    return res.send("Sorry, we are not operating in your area (No Store available)")      
                }
                else
                {
                    rad = rad + 200
                    i = -1
                }
            }

        }
    }

    if (!selectedStore)
    {
       return res.send("No Store Seleted")
    }

       for (var i = 0; i < areas.length; i++) {
        var object = areas[i];

        var dist = geolib.isPointWithinRadius(
            { latitude: selectedStore.location.lat, longitude: selectedStore.location.long},
            { latitude: object.areaCoordinates.lat, longitude: object.areaCoordinates.long },
            2000
        );
        
        if(dist)
        {
            selectedArea = object;
            break;
        }
    }


    const deliveryWorkers = await DeliveryWorker.find({areaCode: selectedArea.areaCode, status: "available"}).select("-password")
   

    for (var i = 0; i < deliveryWorkers.length; i++) {
        var object = deliveryWorkers[i];
        


         d1 =  geolib.getDistance(
            { latitude: object.location.lat, longitude: object.location.long },
            { latitude: selectedStore.location.lat, longitude: selectedStore.location.long }
        );
        
        object["tempDist"] = d1
        deliveryWorkers[i] = object;
            
    }


   



    const sorted = sortObjectsArray(deliveryWorkers, 'tempDist')
    selectedDeliveryWorker = sorted[0];



    if(!selectedDeliveryWorker) {
        return res.send("No deliveryWorker")
    }

     console.log("Selected Area: " + selectedArea.areaCode)
    console.log("Store Selected: " + selectedStore.storeName)
    console.log("Delivery Worker selected:" + selectedDeliveryWorker.name)
    console.log("Delivery Worker selected:" + selectedDeliveryWorker.tempDist)
    

       
    let order = new Order(

        {
            
            customer: req.body.customer,
            orderitems: req.body.orderitems,
            total: req.body.total,
            store: selectedStore,
            deliveryWorker: selectedDeliveryWorker
        }
 );

//  const {error} =  orderValidationfirst(req.body);

//  if(error) {
//      return res.status(400).send(error);
//  }


    try {

        for (var i = 0; i < req.body.orderitems.length; i++) {
            var object = req.body.orderitems[i];

            var count = object.quantity;

            const product = await Product.findByIdAndUpdate({_id: object._id},{
                $inc: {
                    bought: count
                }
                
            });
                
        }

        order = await order.save();
        
       return res.send(order);

    }
    catch(ex)
    {
        console.log(ex.message)
    }
    
});



orderRouter.get("/getOrders", async(req, res)=>{

   
    req.app.io.of("/apis/order/socket").emit("orderUpdate2", "It is FUCKING WORKING");
    console.log(".............................")


    const orders = await Order.find();   

    if(!orders) return res.status(404).send("Not found")



    return res.send(orders);
 
});


module.exports = orderRouter;
