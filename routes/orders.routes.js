const express = require('express');

// Controllers
const {
	addProductToCart,
	getUserCart,
	updateProductCart,
	purchaseOrder,
	getAllOrdersFromUser
} = require('../controllers/orders.controller');

// Middlewares
const {
	updateProductCartValidations,
	validateResult,
} = require('../middlewares/validators.middleware');
const { protectSession } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protectSession);

// Get user's cart
router.get('/get-cart', getUserCart);

// Add product to cart
router.post('/add-product-to-cart', addProductToCart);

// do purshace cart
router.post('/purshace-cart', purchaseOrder);

// get all orders from a user
router.post('/get-all-orders', getAllOrdersFromUser);


// Update cart product quantity
router.patch(
	'/update-cart-product',
	updateProductCartValidations,
	validateResult,
	updateProductCart
);

// Remove product from cart

// Create order

// Get user's orders

module.exports = { ordersRouter: router };
