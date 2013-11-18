var mod = require('../lib/payment.js');
var crypto = require('crypto');

var createValidBody = function(privateKey, orderId, returnCode) {
	var settled = '1';
	var input = '' + privateKey +'|'+ returnCode +'|'+ orderId;

	if(returnCode == '0') {
		input = input +'|'+ settled;
	}

	var hash = crypto.createHash('md5').update(input).digest("hex");
	var authcode = hash.toUpperCase();

	var result = {
		RETURN_CODE: returnCode,
		ORDER_NUMBER: orderId,
		AUTHCODE: authcode
	};

	if(returnCode == '0') {
		result.SETTLED = settled;
	}

	return result;
};

var createRequest = function(privateKey, orderId, returnCode) {
	return {
		body: createValidBody(privateKey, orderId, returnCode)
	};
};

var appProxy = {
	get: function(key) {
		if(key === 'payment_pay_url') return 'https://www.paybyway.com/e-payments/test_pay';
		if(key === 'payment_return_url') return 'https://localhost/paid';
		if(key === 'payment_cancel_url') return 'https://localhost/cancelled';

		if(key === 'payment_demo_pay_url') return 'demopay';
		if(key === 'payment_demo_return_url') return 'demopaid';
		if(key === 'payment_demo_cancel_url') return 'democancelled';

		return 'unknown key asked';
	}
};

var anyMerchantId = 1111;
var anyPrivateKey = '1234125126362364';

describe("Payment module", function() {
	it("has a factory function for itself", function() {
		var product = mod.create(appProxy);
		expect(product).not.toBeUndefined();
	});

	it("asks the urls from given object", function() {
		var returnUrl = 'asdfasdfasdfjkjaskdj';
		var cancelUrl = 'aserqjwkefvxczv';
		var payUrl = 'sadfwersdboijijvcxoiase';

		var proxy = {
			get: function(key) {
				if(key === 'payment_pay_url') return payUrl;
				if(key === 'payment_return_url') return returnUrl;
				if(key === 'payment_cancel_url') return cancelUrl;
				return 'garbage';
			}
		};
		var product = mod.create(proxy);

		expect(product.returnAddress).toEqual(returnUrl);
		expect(product.cancelAddress).toEqual(cancelUrl);
		expect(product.url).toEqual(payUrl);
	});

	it("asks the demo urls from given object", function() {
		var returnUrl = 'demo asdfasdfasdfjkjaskdj';
		var cancelUrl = 'demo aserqjwkefvxczv';
		var payUrl = 'demo sadfwersdboijijvcxoiase';

		var proxy = {
			get: function(key) {
				if(key === 'payment_demo_pay_url') return payUrl;
				if(key === 'payment_demo_return_url') return returnUrl;
				if(key === 'payment_demo_cancel_url') return cancelUrl;
				return 'garbage';
			}
		};
		var product = mod.create(proxy);

		expect(product.demoReturnAddress).toEqual(returnUrl);
		expect(product.demoCancelAddress).toEqual(cancelUrl);
		expect(product.demoUrl).toEqual(payUrl);
	});

	it("has properties for holding merchant data", function() {
		var instance = mod.create(appProxy);
		expect(instance.merchantId).toBeUndefined();
		expect(instance.privateKey).toBeUndefined();
		expect(instance.returnAddress).not.toBeUndefined();
		expect(instance.cancelAddress).not.toBeUndefined();
	});

	it("has a property holding the test url", function() {
		var instance = mod.create(appProxy);
		expect(instance.url).toMatch(/test_pay/);
	});

	describe("There is a way for setting demo mode", function() {
		it("selects the real payment interface for real payments", function() {
			var instance = mod.create(appProxy);
			var data = instance.createPayment(true);
			var url = instance.paymentUrl(data.ORDER_NUMBER);
			expect(url).toMatch(/\/test_pay$/);
		});

		it("selects the test payment interface for demos", function() {
			var instance = mod.create(appProxy);
			var data = instance.createPayment(false);
			var url = instance.paymentUrl(data.ORDER_NUMBER);
			expect(url).toMatch(/demopay/);
		});

		it("switches between the callback urls (case: to real payments)", function() {
			var instance = mod.create(appProxy);
			var payment = instance.createPayment(true);
			expect(payment.RETURN_ADDRESS).toMatch(/\/paid$/);
			expect(payment.CANCEL_ADDRESS).toMatch(/\/cancelled$/);
		});

		it("switches between the callback urls (case: to demo payments)", function() {
			var instance = mod.create(appProxy);
			var payment = instance.createPayment(false);
			expect(payment.RETURN_ADDRESS).toMatch(/demopaid$/);
			expect(payment.CANCEL_ADDRESS).toMatch(/democancelled$/);
		});
	});

	describe("There is a factory method for payment data", function() {
		it("exists", function() {
			var instance = mod.create(appProxy);
			expect(typeof instance.createPayment === 'function').toBe(true);
		});

		it("returns form data as an object", function() {
			var instance = mod.create(appProxy);
			var tested = instance.createPayment();
			expect(tested).not.toBeUndefined();
		});

		it("generates unique order number for each payment", function() {
			var instance = mod.create(appProxy);
			var first = instance.createPayment(true);
			var second = instance.createPayment(true);
			expect(first.ORDER_NUMBER).not.toBeUndefined();
			expect(second.ORDER_NUMBER).not.toBeUndefined();
			expect(first.ORDER_NUMBER).not.toEqual(second.ORDER_NUMBER);
		});

		it("returns form data with the given amount", function() {
			var instance = mod.create(appProxy);
			var amount = 2436;
			var amountInCentsAndAsString = '' + 100*amount;
			var data = instance.createPayment(true, amount);
			expect(data.AMOUNT).toEqual(amountInCentsAndAsString);
		});

		it("takes a callback having the first parameter to indicate no error", function() {
			var instance = mod.create(appProxy);
			var amount = 1;
			var theFirstParameter;
			var mock = {
				receiver: function(error) {
					theFirstParameter = error;
				}
			};

			spyOn(mock, 'receiver').andCallThrough();

			var data = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, mock.receiver);

			instance.successfulPaymentHandler(createRequest(anyPrivateKey, data.ORDER_NUMBER, '0'));

			expect(mock.receiver).toHaveBeenCalled();
			expect(theFirstParameter).toBeNull();
		});

		it("creates payment with different merchat ids and private keys", function() {
			var instance = mod.create(appProxy);

			var amount_1 = 1;
			var amount_2 = 453;
			var amount_3 = 4;

			var merchantId_1 = 23;
			var merchantId_2 = 2323;
			var merchantId_3 = 223;

			var privateKey_1 = '123542324312';
			var privateKey_2 = '436578346533';
			var privateKey_3 = '43wefsadfa33';

			var theErrorParamater_1;
			var theIdParameter_1;
			var theErrorParamater_2;
			var theIdParameter_2;
			var theErrorParamater_3;
			var theIdParameter_3;
			var mock = {
				theCallback_1: function(error, id) {
					theErrorParamater_1 = error;
					theIdParameter_1 = id;
				},

				theCallback_2: function(error, id) {
					theErrorParamater_2 = error;
					theIdParameter_2 = id;
				},

				theCallback_3: function(error, id) {
					theErrorParamater_3 = error;
					theIdParameter_3 = id;
				}
			};

			spyOn(mock, 'theCallback_1').andCallThrough();
			spyOn(mock, 'theCallback_2').andCallThrough();
			spyOn(mock, 'theCallback_3').andCallThrough();

			var payment_1 = instance.createPayment(true, amount_1, merchantId_1, privateKey_1, mock.theCallback_1);
			var payment_2 = instance.createPayment(true, amount_2, merchantId_2, privateKey_2, mock.theCallback_2);
			var payment_3 = instance.createPayment(true, amount_3, merchantId_3, privateKey_3, mock.theCallback_3);

			instance.successfulPaymentHandler(createRequest(privateKey_1, payment_1.ORDER_NUMBER, '0'));
			instance.successfulPaymentHandler(createRequest(privateKey_3, payment_3.ORDER_NUMBER, '0'));
			instance.successfulPaymentHandler(createRequest(privateKey_2, payment_2.ORDER_NUMBER, '0'));

			expect(mock.theCallback_1).toHaveBeenCalled();
			expect(theIdParameter_1).toBe(payment_1.ORDER_NUMBER);
			expect(theErrorParamater_1).toBeNull();

			expect(mock.theCallback_2).toHaveBeenCalled();
			expect(theIdParameter_2).toBe(payment_2.ORDER_NUMBER);
			expect(theErrorParamater_2).toBeNull();

			expect(mock.theCallback_3).toHaveBeenCalled();
			expect(theIdParameter_3).toBe(payment_3.ORDER_NUMBER);
			expect(theErrorParamater_3).toBeNull();
		});

		it("provides mechanism for unique callbacks for every payment", function() {
			var instance = mod.create(appProxy);
			var amount = 1;

			var mockOne = {
				id: 0,
				receiver: function(error, orderId) {
					this.id = orderId;
				}
			};

			var mockTwo = {
				id: 0,
				receiver: function(error, orderId) {
					this.id = orderId;
				}
			};

			spyOn(mockOne, 'receiver').andCallThrough();
			spyOn(mockTwo, 'receiver').andCallThrough();

			var one = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, function(error, id) {
				 mockOne.receiver(error, id);
			});
			var two = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, function(error, id) {
				mockTwo.receiver(error, id);
			});

			var reqOne = createRequest(anyPrivateKey, one.ORDER_NUMBER, '0');
			var reqTwo = createRequest(anyPrivateKey, two.ORDER_NUMBER, '0');

			instance.successfulPaymentHandler(reqOne);
			instance.successfulPaymentHandler(reqTwo);

			expect(mockOne.receiver).toHaveBeenCalled();
			expect(mockTwo.receiver).toHaveBeenCalled();

			expect(mockOne.id).toEqual(one.ORDER_NUMBER);
			expect(mockTwo.id).toEqual(two.ORDER_NUMBER);
		});
	});
	

	describe("the payment module provides a successful payment handler", function() {
		it("has a handler for successful payment handler function", function() {
			var instance = mod.create(appProxy);
			expect(typeof instance.successfulPaymentHandler === 'function').toBe(true);
		});

		it("provides the order number with the callback", function() {
			var instance = mod.create(appProxy);
			var amount = 2;
			var theFirstParameter = null;
			var theSecondParamater;
			var mock = {
				receiver: function(error, orderId) {
					theFirstParameter = error;
					theSecondParamater = orderId;
				}
			};

			spyOn(mock, 'receiver').andCallThrough();

			var data = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, mock.receiver);

			instance.successfulPaymentHandler(createRequest(anyPrivateKey, data.ORDER_NUMBER, '0'));

			expect(mock.receiver).toHaveBeenCalled();
			expect(theFirstParameter).toBeNull();
			expect(theSecondParamater).not.toBeUndefined();
			expect(theSecondParamater).toEqual(data.ORDER_NUMBER);
		});	

		it("gives an error if there is mismatched authcode", function() {
			var instance = mod.create(appProxy);
			var amount = 2;
			var theFirstParameter = null;
			var mock = {
				receiver: function(error, orderId) {
					theFirstParameter = error;
				}
			};

			spyOn(mock, 'receiver').andCallThrough();

			var data = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, function(error, id) {
				mock.receiver(error, id);
			});

			var req = createRequest('crap', data.ORDER_NUMBER, '0');
			instance.successfulPaymentHandler(req);

			expect(mock.receiver).toHaveBeenCalled();
			expect(theFirstParameter).not.toBeNull();
		});

		it("gives an error if there is non zero return code", function() {
			var instance = mod.create(appProxy);
			var amount = 2;
			var theFirstParameter = null;
			var mock = {
				receiver: function(error, orderId) {
					theFirstParameter = error;
				}
			};

			spyOn(mock, 'receiver').andCallThrough();

			var data = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, mock.receiver);

			var req = createRequest(anyPrivateKey, data.ORDER_NUMBER, '1');
			instance.successfulPaymentHandler(req);

			expect(mock.receiver).toHaveBeenCalled();
			expect(theFirstParameter).not.toBeNull();
			expect(theFirstParameter).toEqual('weird RETURN_CODE');
		});
	});

	describe("the payment module provides a failed payment handler", function() {
		it("has a handler for failed payment function", function() {
			var instance = mod.create(appProxy);
			expect(typeof instance.failedPaymentHandler === 'function').toBe(true);
		});

		it("provides the order number with the callback", function() {
			var instance = mod.create(appProxy);
			var amount = 2;
			var theFirstParameter = null;
			var theSecondParamater;
			var mock = {
				receiver: function(error, orderId) {
					theFirstParameter = error;
					theSecondParamater = orderId;
				}
			};

			spyOn(mock, 'receiver').andCallThrough();

			var data = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, mock.receiver);

			instance.failedPaymentHandler(createRequest(instance.privateKey, data.ORDER_NUMBER, '1'));

			expect(mock.receiver).toHaveBeenCalled();
			expect(theFirstParameter).not.toBeNull();
			expect(theSecondParamater).toEqual(data.ORDER_NUMBER);
		});	

		it("gives an error if there is mismatched authcode", function() {
			var instance = mod.create(appProxy);
			var amount = 2;
			var theFirstParameter = null;
			var mock = {
				receiver: function(error, orderId) {
					theFirstParameter = error;
				}
			};

			spyOn(mock, 'receiver').andCallThrough();

			var data = instance.createPayment(true, amount, anyMerchantId, anyPrivateKey, mock.receiver);

			var req = createRequest(instance.privateKey, data.ORDER_NUMBER, '1');
			req.body.RETURN_CODE = '2141234122222';
			instance.failedPaymentHandler(req);

			expect(mock.receiver).toHaveBeenCalled();
			expect(theFirstParameter).not.toBeNull();
		});
	});
});
