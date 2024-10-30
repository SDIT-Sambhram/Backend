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

        console.log("Razorpay order created:", order);
        return order;
        

    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw new Error("Could not create Razorpay order");
    }
};