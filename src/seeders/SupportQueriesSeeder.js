import { SupportQueryMaster } from "../Models/SupportModels/SupportQueriesMaster.js";

export const SupportQueriesMasterSeeder = async(req, res)=>{
    try{
        await SupportQueryMaster.bulkCreate([
            {  name: "Technical Issue" },
            {  name: "Test-related" },
            {  name: "Session / Booking" },
            {  name: "Payments" },
            {  name: "Suggestions" },
            {  name: "Other" },
        ],{
            ignoreDuplicates: true
        });
        return res.status(201).json({ message: "Support queries master data seeded successfully" });
    } catch (error) {
        console.error("Error seeding support queries master data:", error);
        return res.status(500).json({ message: "Failed to seed support queries master data", error });
    }
}