import razorpayInstance from "../configs/razorpay.js";
import crypto from "crypto";

// Create an order
export const createOrder = async (phone, registrations, usn, name, decodedCollege) => {
    try {
        let amount;

        const eventLength = registrations.length;

        const eventPricing = {
            1: 100,
            2: 160,
            3: 220,
            4: 250
        };
        
        if (eventLength in eventPricing) {
            amount = eventPricing[eventLength];
        } else {
            console.log("You can't have more than 4 events");
        }
        
        const options = {
            amount: amount * 100,  // Amount in paise
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`,  // Unique identifier for tracking orders
            notes: {
                name: name,
                usn: usn,
                phone: phone,
                college: decodedCollege,
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
