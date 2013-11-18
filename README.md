# Payment Maksukaista

## Overview
This module can be used for making payments through Maksukaista.fi API.
It is designed to be used with express and its body parser.
You can use callback functions to the responses of payments.
Also, you can have multiple (sub)merchant ids simultaneously.

Example:

	var paymentFormData = handler.createPayment(
		true,
		totalSum,
		merchantId,
		privateKey, 
		function(error, orderId) {
			if(!error) {
				// paid
			}
			else {
				// payment failed
			}
	});

	var url = handler.paymentUrl(paymentFormData.ORDER_NUMBER);
	res.render('pay', { 
		url: url,
		fields: paymentFormData
	});

	// a form is then constructed from payment data and url.
	// an example jade snipped:

    form(id='confirm-payment-form', action=url, method='post')
      each val, p in fields
        input(type='hidden', name=p, value=val)
      input(name='confirm-payment', type='submit', value='Pay now')

## Installation
Installation is simple, install the npm module:

    npm install payment-maksukaista

## Usage
### Initialization
The create function of the module takes an object as the first parameter 
which supplies the supported return addresses required by Maksukaista.
Also, the object provides the URL for test mode and the actual
Maksukaista API.

Here's an example showing how to create an instance 
and configure it with express.

	var app = express();

	app.configure('development', function () {
	  app.set('payment_return_url', 'https://localhost/paid');
	  app.set('payment_cancel_url', 'https://localhost/failed');
	  app.set('payment_pay_url', 'https://www.paybyway.com/e-payments/pay');

	  app.set('payment_demo_return_url', 'https://localhost/paid');
	  app.set('payment_demo_cancel_url', 'https://localhost/failed');
	  app.set('payment_demo_pay_url', 'https://www.paybyway.com/e-payments/test_pay');
	});

	var payment = require('payment-maksukaista');
	var handler = payment.create(app);

### Setup the routes
The app needs to provide routes for the callback addresses 
for Maksukaista to report the result of a payment.

Note that these needs to match the addresses configured in the initialization.

Example routes:

	app.post('/paid', handler.successfulPaymentHandler, function(req, res) {
		// ...
	});

	app.post('/failed', handler.failedPaymentHandler, function(req, res) {
		// ...
	});

### Make the payment
A payment is performent in two phases. 
First, all data is gathered and generated for the payment.
It is archieved by calling the createPayment function.

	var paymentFormData = payment.createPayment(
		true,
		totalSum,
		merchantId,
		privateKey, 
		function(error, orderId) {
			if(!error) {
				// paid
			}
			else {
				// payment failed
			}
	});

The first parameter tells if we want to use the Maksukaista API (true) or 
its test interface (the demo mode, false).

The API or test interface URL is given by the paymentUrl function.
The selection is done by the given order number/id of previously 
created payment data.

	var url = handler.paymentUrl(paymentFormData.ORDER_NUMBER);

Second, a form is shown to the user. 
See the Overview chapter above for an example.
The form contains the fields from the payment data. 
The action URL should be the URL returned by paymentUrl.
When the form is submitted, the payment is triggered.

## Testing
To run the tests:

	npm test

## License
Released under the MIT License. 
Copyright Panu Puro https://github.com/pmpuro