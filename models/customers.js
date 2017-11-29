module.exports = function(sequelize, DataTypes) {

    var Customer = sequelize.define('Customer', {
       
        customer_name: {
            type: DataTypes.STRING,
            validate: {
                len: [1]
            }
        }
    }, 
    {

        timestamps: false
    });
    return Customer;
};