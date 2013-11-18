var crypto = require('crypto');

exports.create = function(app) {
	return {
		returnAddress: app.get('payment_return_url'),
		cancelAddress: app.get('payment_cancel_url'),
		url: app.get('payment_pay_url'),

		demoReturnAddress: app.get('payment_demo_return_url'),
		demoCancelAddress: app.get('payment_demo_cancel_url'),
		demoUrl: app.get('payment_demo_pay_url'),

		counter: 1,

		compileAuthCode: function(key, req) {
			var input = '' + key 
				+'|'+ req.body.RETURN_CODE 
				+'|'+ req.body.ORDER_NUMBER;

			if(req.body.RETURN_CODE === '0') {
				input = input +'|'+ req.body.SETTLED;
			}
			else if(req.body.INCIDENT_ID) {
				input = input +'|'+ req.body.INCIDENT_ID;
			}

			var hash = crypto.createHash('md5').update(input).digest("hex");
			var authcode = hash.toUpperCase();

			return authcode;
		},

		successfulPaymentHandler: function(req, res) {
			var orderId = req.body.ORDER_NUMBER;
			var payment = this.getPayment(orderId);

			if(!payment) return;

			var authcode = this.compileAuthCode(payment.key, req);

			if(authcode === req.body.AUTHCODE) {
				if(req.body.RETURN_CODE == '0') {
					// payment ok
					this.callBack(payment, null, orderId);
				}
				else {
					// payment failed
					this.callBack(payment, 'weird RETURN_CODE', orderId);
				}
			}
			else {
				// tampering, payment failed
				this.callBack(payment, 'tampered', orderId);
			}
		},

		failedPaymentHandler: function(req, res) {
			var orderId = req.body.ORDER_NUMBER;
			var payment = this.getPayment(orderId);

			if(!payment) return;

			var authcode = this.compileAuthCode(payment.key, req);

			if(authcode === req.body.AUTHCODE) {
				this.callBack(payment, 'payment failed', orderId);
			}
			else {
				// tampering detected, payment failed, perhaps?!
				this.callBack(payment, 'tampered', orderId);
			}
		},

		callbacks: {},

		getPayment: function(orderId) {
			return this.callbacks[orderId];
		},

		callBack: function(payment, error, id) {
			var fn = payment.callback;
			if(fn) {
				fn(error, id);
			}

			delete this.callbacks[id];
		},

		paymentUrl: function(orderId) {
			var payment = this.getPayment(orderId);
			var result = this.url;

			if(payment.demo) {
				result = this.demoUrl;
			}

			return result;
		},

		createPayment: function(realPayment, amount, merchant, key, callback_fn) {
			var orderId = 'B' + Date.now() + '_' + this.counter++;

			this.callbacks[orderId] = { 
				demo: !realPayment,
				amount: amount,
				merchant: merchant,
				key: key,
				callback: callback_fn 
			};

			var currency = 'EUR';
			var language = 'FI';

			var usedReturnAddress = this.returnAddress;
			var usedCancelAddress = this.cancelAddress;

			if(!realPayment) {
				usedReturnAddress = this.demoReturnAddress;
				usedCancelAddress = this.demoCancelAddress;
			}

			var amountInCents = (amount * 100).toFixed();

			var input = ''+ key
				+'|'+ merchant 
				+'|'+ amountInCents 
				+'|'+ currency 
				+'|'+ orderId 
				+'|'+ language 
				+'|'+ usedReturnAddress 
				+'|'+ usedCancelAddress;

			var hash = crypto.createHash('md5').update(input).digest("hex");
			var authcode = hash.toUpperCase();

			var result = {
				MERCHANT_ID: merchant,
				AMOUNT: amountInCents,
				CURRENCY: currency,
				ORDER_NUMBER: orderId,
				LANG: language,
				RETURN_ADDRESS: usedReturnAddress,
				CANCEL_ADDRESS: usedCancelAddress,
				AUTHCODE: authcode
			};

			return result;
		}
	};
}
