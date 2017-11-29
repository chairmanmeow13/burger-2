/* ************************************************************************ */
/*
    Server API Routing                                     
*/
module.exports = function(app) {

// NOTE: Not currently time-stamping the burgers, the assignment
// didn't specify its purpose.
    var ts = require('time-stamp');

    // go to the '../models' and look for 'index.js'
    var db = require('../models');

    // Views, one for burgers and the other is for customer management
    var bview = require('../views/burger-view.js').burgerview;
    var cview = require('../views/customer-view.js').customerview;

    // this object contains data that we'll use with the Handlebars
    // templates
    var renderdata = {
        customers: [],      // customer list
        count: 0,           // total count of burgers
        eat: [],            // burgers to be eaten(devoured)
        ate: []             // burgers that have been eaten
    };

    // all findAll() calls use this ordering
    var orderBy = {order: 'id ASC'};

    /* ******************************************************************** */
    /*
        GET /index - Renders the index page, first it will read all of the 
        customers and then the burgers. The customer names will be used to
        populate the drop-down customer picker.
    */
    app.get('/index', function(req, res) {
        // clear any previous customer data
        renderdata.customers.splice(0, renderdata.customers.length);
        // find all customers...
        db.Customer.findAll(orderBy)
        .then(function(customers) {
            // got customers, copy them and break any references
            renderdata.customers = JSON.parse(JSON.stringify(customers));
            db.Burger.findAll(orderBy)
            .then(function(burgers) {
                renderdata.count = burgers.length;
                //  clear the burger lists
                renderdata.ate.splice(0, renderdata.ate.length);
                renderdata.eat.splice(0, renderdata.eat.length);
                // sort the burgers into "not devoured" and "devoured"
                for(var idx = 0;idx < burgers.length;idx++) {
                    var burger = JSON.parse(JSON.stringify(burgers[idx]));
                    if(burger.devoured) {
                        renderdata.ate.push(burger);
                    } else renderdata.eat.push(burger);
                }
                bview.renderIndex(res, renderdata);
            });
        });
    });

    /*
        GET /admin - Renders the burger admin page, where it's
        possible to delete a burger. 
        NOTE: After the last existing burger is deleted the
        "init" page will be rendered.
    */
    app.get('/admin', function(req, res) {
        db.Burger.findAll({orderBy})
        .then(function(burgers) {
            renderdata.count = burgers.length;
            renderdata.ate.splice(0, renderdata.ate.length);;
            renderdata.eat.splice(0, renderdata.eat.length);;
            for(var idx = 0;idx < burgers.length;idx++) {
                var burger = JSON.parse(JSON.stringify(burgers[idx]));
                var newburger;
                // when displayed, burgers are shown `devoured=no` first and
                // followed by `devoured=yes`
                if(burger.devoured) {
                    newburger = Object.assign({}, burger, {devouredstr : 'YES'});
                    renderdata.ate.push(newburger);
                } else {
                    newburger = Object.assign({}, burger, {devouredstr : 'NO'});
                    renderdata.eat.push(newburger);
                }
            }
            var adminBurgers = Object.assign({}, renderdata, {total :(renderdata.eat.length+renderdata.ate.length)});
            if(adminBurgers.total > 0)
                bview.renderAdmin(res, adminBurgers);
            else bview.renderInit(res);
        });
    });

    /*
        GET /cust - Render the customer admin page
    */
    app.get('/cust', function(req, res) {
        db.Customer.findAll(orderBy)
        .then(function(customers) {
            if(customers.length > 0) 
                cview.renderCustomers(res, customers);
            else cview.renderCustInit(res);
        });
    });

    /* ******************************************************************** */
    /*
        POST /index - This path is used for :
            -> Creating a new burger
            -> Changing burger state between Devoured and Not-Devoured
    */
    app.post('/index', function(req, res) {
        if(req.body.burgertext !== undefined) {
            db.Burger.create({
                burger_name: req.body.burgertext,
                devoured: false,
                // apparently sequelize doesn't like this
                // date format where plain old mysql didn't 
                // have any issue.
                // SOLUTION: Change field to the STRING type
                date: ts('YYYY:MM:DD HH:mm:ss'),
                eatenby: null
            })
            .then(function(dbBurger) {
                renderdata.eat.push(dbBurger);
                renderdata.count += 1;
                bview.renderIndex(res, renderdata);
            });
        } else {
            // NOTE: It seems that handlebars is NOW having
            // an issue with how it renders the value into
            // #burgerdev. At this time (2017-01-31) the 
            // version (https://github.com/jxmot/burger) 
            // that was initially pushed to Heroku works
            // just fine. The cause of the problem definitely
            // appears to be occurring in Handlebars. In the 
            // original the values were value="0" and 
            // value="1", but now they're value="false" and 
            // value="true". And the "type" has not changed in
            // the database devoured column. So that leaves 
            // Handlebars or one of it's dependencies.
            if(req.body.burgerid !== undefined) {
                // null IS allowed for the customer name in a
                // not-devoured burger
                var cust = null;

                // If the burger is currently not-devoured then 
                // we're about to change its state to devoured.
                // The customer id was kept in the form data
                // and we'll use it to retreive the customer
                // name. The name is what is stored in the 
                // devoured-burger record.
                if(stringToBool(req.body.burgerdev) === false) {
                    cust = getCustomer(renderdata.customers, parseInt(req.body.burgcust));
                }
                
                var aBurger = {
                    // this is the fix for the handlebars problem
                    // that was described above
                    devoured: (!stringToBool(req.body.burgerdev)),
                    // apparently sequelize doesn't like this
                    // date format where plain old mysql didn't 
                    // have any issue.
                    // SOLUTION: Change field to the STRING type
                    date: ts('YYYY:MM:DD HH:mm:ss'),
                    
                    // customer name
                    eatenby: cust
                };

                // Update the burger's state...
                db.Burger.update(aBurger,
                {
                    where: {
                        id: req.body.burgerid
                    }
                })
                .then(function(dummy) {
                    // a burger has been updated, find the updated
                    // record and then update our local burger list(s)
                    db.Burger.findOne({
                        where: {
                            id: req.body.burgerid
                        }
                    })
                    .then(function(dbBurger) {
                        // copy the burger record and break any references
                        var burger = JSON.parse(JSON.stringify(dbBurger));
                        // Depending on the devoured state of the burger 
                        // either remove or add it to the appropriate state
                        // list
                        if(burger.devoured) {
                            removeBurger(burger, renderdata.eat);
                            renderdata.ate.push(burger);
                        } else {
                            removeBurger(burger, renderdata.ate);
                            renderdata.eat.push(burger);
                        }
                        // render the updated burger list displays
                        bview.renderIndex(res, renderdata);
                    });
                });
            }
        }
    });

    /*
        POST /admin - Used when deleting a burger while on the
        burger admin page
    */
    app.post('/admin', function(req, res) {
        db.Burger.destroy(
        {
            where: {
                id: req.body.burgerid
            }
        })
        .then(function() {
            // Use the burger devoured state to decide which
            // burger-state list to remove it from
            if(stringToBool(req.body.burgerdev) === false) {
                removeBurger({id: parseInt(req.body.burgerid)}, renderdata.eat);
            } else {
                removeBurger({id: parseInt(req.body.burgerid)}, renderdata.ate);
            }
            // Update the burger lists
            var adminBurgers = Object.assign({}, renderdata, {total :(renderdata.eat.length+renderdata.ate.length)});
            // if no more burgers are left then render the 
            // burger-initialize page automatically
            if(adminBurgers.total > 0)
                bview.renderAdmin(res, adminBurgers);
            else bview.renderInit(res);
        });
    });

    /*
        POST /init - This path is reached automatically when the
        quantity of burgers in the database is 0 - not really, the
        "initialize data" page is rendered giving the user the 
        opportunity to initialize the data.
    */
    app.post('/init', function(req, resObj) {
        // let's read our burger seed-data and write it to the
        // database
        var burgersIN = require('../config/burgers.json');
        db.Burger.bulkCreate(burgersIN)
        .then(function(res) {
            // clear any previous customer data
            renderdata.customers.splice(0, renderdata.customers.length);
            // find all customers...
            db.Customer.findAll(orderBy)
            .then(function(customers) {
                // got customers, copy them and break any references
                renderdata.customers = JSON.parse(JSON.stringify(customers));
                // retrieve all burgers from the database and update
                // the burger lists
                db.Burger.findAll(orderBy)
                .then(function(burgers) {
                    renderdata.count = burgers.length;
                    renderdata.ate.splice(0, renderdata.ate.length);
                    renderdata.eat.splice(0, renderdata.eat.length);
                    for(var idx = 0;idx < burgers.length;idx++) {
                        var burger = JSON.parse(JSON.stringify(burgers[idx]));
                        if(burger.devoured)
                            renderdata.ate.push(burger);
                        else renderdata.eat.push(burger);
                    }
                    // finished seeding the data, render the index page
                    // and show the burgers
                    bview.renderIndex(resObj, renderdata);
                });
            });
        });
    });

    /*
        POST /custadd - This path is reached from the customer 
        page when the user adds a customer name
    */
    app.post('/custadd', function(req, res) {
        if(req.body.custname !== undefined) {
            db.Customer.create({
                customer_name: req.body.custname
            })
            .then(function(dbCustomer) {
                // A customer was added to the database, so 
                // retrieve all customer records and render
                // them to this page.
                // NOTE: The locally stored customer list is
                // not updated at this time. It's only updated
                // when the burger data is read. Then it is 
                // guaranteed to be current when the burgers
                // are displayed on the index page.
                db.Customer.findAll(orderBy)
                .then(function(customers) {
                    cview.renderCustomers(res, customers);
                });
            });
        }
    });

    /*
        POST /custdel - This path is reached from the customer 
        page when the user deletes a customer name
    */
    app.post('/custdel', function(req, resObj) {
        db.Customer.destroy(
        {
            where: {
                id: req.body.custid
            }
        })
        .then(function() {
            db.Customer.findAll(orderBy)
            .then(function(customers) {
                if(customers.length > 0)
                    cview.renderCustomers(resObj, customers);
                else cview.renderCustInit(resObj);
            });
        });
    });

    /*
        POST /custinit - This path is reached automatically when the
        quantity of customers in the database is 0
    */
    app.post('/custinit', function(req, resObj) {
        // let's read our customer seed-data and write it to the
        // database
        var customersIN = require('../config/customers.json');
        db.Customer.bulkCreate(customersIN)
        .then(function(res) {
            db.Customer.findAll(orderBy)
            .then(function(customers) {
                if(customers.length > 0) 
                    cview.renderCustomers(resObj, customers);
                else cview.renderCustInit(resObj);
            });
        });
    });

    /* ******************************************************************** */
    /*
        Module Private Utility Functions
        Remove a specific burger from a burger-state list
    */
    function removeBurger(burger, list) {
        for(var idx = 0;idx < list.length;idx++) {
            if(burger.id === list[idx].id) {
                list.splice(idx, 1);
                break;
            }
        }
    };

    /*
        String ("true" or "false") conversion to a boolean
        data type
    */
    function stringToBool(bStr) {
        var bRet = false;
        
        switch(bStr.toLowerCase()) {
            case 'true':
                bRet = true;
                break;

            case 'false':
                bRet = false;
                break;
        }
        return bRet;
    };

    /*
        Use a customer table row ID to find the customer name
        and return it to the caller
    */
    function getCustomer(custlist, custID) {
        var cust = '';

        for(var idx = 0;idx < custlist.length;idx++) {
            if(custID === custlist[idx].id) {
                cust = custlist[idx].customer_name;
                break;
            }
        }
        return cust;
    }
};