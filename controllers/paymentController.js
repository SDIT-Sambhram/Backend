import razorpayInstance from "../configs/razorpay.js";
import crypto from "crypto";

// Create an order
export const createOrder = async (amount) => {
    try {
        const order = await razorpayInstance.orders.create({
            amount: amount * 100, // Amount in paise
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`
        });

        return {
            success: true,
            amount: order.amount,
            currency: order.currency,
            orderId: order.id
        };
        

    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw new Error("Could not create Razorpay order");
    }
};

// Verify payment
export const verifyPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
    try {
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        
        return generatedSignature === razorpay_signature;
    } catch (error) {
        console.error("Error verifying payment:", error);
        throw new Error("Payment verification failed");
    }
};
