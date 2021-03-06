// Models
const { Product } = require('../models/product.model');
const { Cart } = require('../models/cart.model');
const { ProductInCart } = require('../models/productInCart.model');
const { Order } = require('../models/order.model');
const { ProductInOrder } = require('../models/productInOrder.model');

// Utils
const { catchAsync } = require('../utils/catchAsync');
const { filterObj } = require('../utils/filterObj');
const { AppError } = require('../utils/appError');
const { formatUserCart } = require('../utils/queryFormat');
const { Email } = require('../utils/email');

exports.getUserCart = catchAsync(async (req, res, next) => {
	const { currentUser } = req;

	const cart = await Cart.findOne({
		attributes: { exclude: ['userId', 'status'] },
		where: { userId: currentUser.id, status: 'onGoing' },
		include: [
			{
				model: ProductInCart,
				attributes: { exclude: ['cartId', 'status'] },
				where: { status: 'active' },
				include: [
					{
						model: Product,
						attributes: {
							exclude: ['id', 'userId', 'price', 'quantity', 'status'],
						},
					},
				],
			},
		],
	});

	const formattedCart = formatUserCart(cart);

	res.status(200).json({
		status: 'success',
		data: { cart: formattedCart },
	});
});







exports.addProductToCart = catchAsync(async (req, res, next) => {
	const { product } = req.body;
	const { currentUser } = req;


	try {
		const filteredObj = filterObj(product, 'id', 'quantity');
		//const filteredObj = product;

		// Validate if quantity is less or equal to existing quantity
		const productExists = await Product.findOne({
			where: { id: filteredObj.id, status: 'active' },
		});


		if (!productExists || filteredObj.quantity > productExists.quantity) {
			return next(
				new AppError(
					'Product does not exists or it exceeds the available quantity',
					400
				)
			);
		}
	
		// Check if current user already has a cart
		const cart = await Cart.findOne({
			where: { userId: currentUser.id, status: 'onGoing' },
		});
	
		// Create new cart
		if (!cart) {
			const totalPrice = +filteredObj.quantity * +productExists.price;
	
			const newCart = await Cart.create({ userId: currentUser.id, totalPrice });
	
			await ProductInCart.create({
				cartId: newCart.id,
				productId: filteredObj.id,
				quantity: filteredObj.quantity,
				price: productExists.price,
			});
		}
	
		// Update cart
		if (cart) {
			// Check if product already exists on the cart
			const productInCartExists = await ProductInCart.findOne({
				where: {
					cartId: cart.id,
					productId: filteredObj.id,
					status: 'active',
				},
			});
	
			if (productInCartExists) {
				return next(
					new AppError('You already added this product to the cart', 400)
				);
			}
	
			// Add it to the cart
			await ProductInCart.create({
				cartId: cart.id,
				productId: filteredObj.id,
				quantity: filteredObj.quantity,
				price: productExists.price,
			});
	
			// Calculate the cart total price
			const updatedTotalPrice =
				+cart.totalPrice + +filteredObj.quantity * +productExists.price;
	
			await cart.update({ totalPrice: updatedTotalPrice });
		}
	
		res.status(201).json({ status: 'success' });
		
	} catch (error) {
		console.log('error ', error);
	}
});

exports.updateProductCart = catchAsync(async (req, res, next) => {
	const { currentUser } = req;
	const { productId, newQuantity } = req.body;

	// Find user's cart
	const userCart = await Cart.findOne({
		where: { userId: currentUser.id, status: 'onGoing' },
	});

	if (!userCart) {
		return next(new AppError('Invalid cart', 400));
	}

	// Find product in cart
	const productInCart = await ProductInCart.findOne({
		where: {
			productId,
			cartId: userCart.id,
			status: 'active',
		},
		include: [{ model: Product }],
	});

	if (!productInCart) {
		return next(new AppError('Invalid product', 400));
	}

	if (newQuantity > +productInCart.product.quantity) {
		return next(
			new AppError(
				`This product only has ${productInCart.product.quantity} items`,
				400
			)
		);
	}

	if (newQuantity === productInCart.quantity) {
		return next(
			new AppError('You already have that quantity in that product', 400)
		);
	}

	let updatedTotalPrice;

	// Check if user added or removed from the selected product
	// If user send 0 quantity to product, remove it from the cart
	if (newQuantity === 0) {
		updatedTotalPrice =
			+userCart.totalPrice - +productInCart.quantity * +productInCart.price;

		// Update quantity to product in cart
		await productInCart.update({ quantity: 0, status: 'removed' });
	} else if (newQuantity > +productInCart.quantity) {
		// New items were added
		updatedTotalPrice =
			+userCart.totalPrice +
			(newQuantity - +productInCart.quantity) * +productInCart.price;

		// Update quantity to product in cart
		await productInCart.update({ quantity: newQuantity });
	} else if (newQuantity < +productInCart.quantity) {
		// Items were removed from the cart
		updatedTotalPrice =
			+userCart.totalPrice -
			(+productInCart.quantity - newQuantity) * +productInCart.price;

		// Update quantity to product in cart
		await productInCart.update({ quantity: newQuantity });
	}

	// Calculate new total price
	await userCart.update({ totalPrice: updatedTotalPrice });

	res.status(204).json({ status: 'success' });
});





exports.purchaseOrder = catchAsync(async (req, res, next) => {
	const { userId, name, email } = req.body;



						// 1st part:
		// Get user's cart and get the products of the cart
		const cart = await Cart.findOne({
			where: { userId, 
			status: 'onGoing' 
			},
		});


		const productsInCart = await ProductInCart.findAll({
		 	where: { cartId: cart.dataValues.id}
		})

		// Set Cart status to 'purchased'
		await cart.update({status: 'purchased'});

		// Create a new order
		const currentDate = new Date().toISOString().slice(1,10);

		const order = await Order.create({
			userId,
			totalPrice: cart.totalPrice,
			date: currentDate
		});


	// Loop through the products array, for each product
	// Set productInCart status to 'purchased', search for cartId and productId
	// Look for the Product (productId), substract and update the requested qty from the product's qty
	// Create productInOrder, pass orderId, productId, qty, price



	// array of products that will be returned in the response
	let productsPurshased = [];

	for(let i = 0; i < productsInCart.length; i++)
	{
		productsPurshased[i] = productsInCart[i].dataValues;
	}


	const productsPromises = productsInCart.map(async (product, indexProduct) => {


		const product_Db = await Product.findOne({where: { id: product.productId}});

		if(product_Db.dataValues.quantity <= 0)
		{
			return next(
				new AppError(
					`There is noo stock of this product`,
					400
				)
			);
		}


		const productPurshased = await product.update({ status: 'purchased'});

		const newQuantity = product_Db.dataValues.quantity - productPurshased.dataValues.quantity;

		productsPurshased[indexProduct].name = product_Db.name;


		if(newQuantity < 0)
		{
			await product_Db.update({ quantity: 0, status: 'soldOut'});

			const recalculatedPrice = product_Db.dataValues.quantity * product.price / productPurshased.dataValues.quantity;

			await ProductInOrder.create({
				orderId: order.id,
				productId: product.productId,
				price: recalculatedPrice,
				quantity: product_Db.quantity
			});

			// return the left items, not the ones the user requested
			productsPurshased[indexProduct].quantity = product_Db.quantity; 
		}
		else if(newQuantity === 0){
			await product_Db.update({ quantity: newQuantity, status: 'soldOut'});
		}
		else{
			await product_Db.update({ quantity: newQuantity});

			await ProductInOrder.create({
				orderId: order.id,
				productId: product.productId,
				price: product.price,
				quantity: product.quantity
			});
		}
	}); // end map

	await Promise.all(productsPromises);

	let totalPrice = 0;
	for(let i = 0; i < productsPurshased.length; i++)
	{
		totalPrice += +productsPurshased[i].price * +productsPurshased[i].quantity;
	}



	const emaiLInstance = new Email(email);
	emaiLInstance.sendOrder(name, productsPurshased, totalPrice);

		res.status(200).json({ 
			status: 'success',
			productsPurshased });


	// 2nd part:
	// Send email to the user that purchased the order
	// The email must contain the total price and the list of products that it purchased


});



exports.getAllOrdersFromUser = catchAsync(async (req, res, next) => {
	const { userId } = req.body;


	try {
		const orders = await Order.findAll({
			where: { userId },
		});

		if(!orders)
		{
			return next(
				new AppError(
					`Error getting orders`,
					400
				)
			);
		}

		res.status(200).json({ 
			status: 'success',
			orders });

	} catch (error) {
		console.log('error', error);
	}

	// 2nd part:
	// Send email to the user that purchased the order
	// The email must contain the total price and the list of products that it purchased


});

// Create a controller a function that gets all the user's orders
// The response must include all products that purchased