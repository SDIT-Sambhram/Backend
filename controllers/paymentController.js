import razorpayInstance from "../configs/razorpay.js";
import crypto from "crypto";

// Create an order
export const createOrder = async (amount, phone, registrations) => {
    try {

        const options = {
            amount: amount * 100,  // Amount in paise
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`,  // Unique identifier for tracking orders
            notes: {
              phone: phone,
              registrations: registrations,
            },
          };

        const order = await razorpayInstance.orders.create(options);

        console.log("Razorpay order created:", order);
        return order;
        

    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw new Error("Could not create Razorpay order");
    }
};