// // File: src/controllers/catalogue.controller.js

// import { CatalogueNode } from "../Models/catalogueNode.model.js";
// import { Op } from "sequelize";

// // ✅ Create a new node
// export const createCatalogueNode = async (req, res) => {
//   try {
//     const node = await CatalogueNode.create(req.body);
//     return res.status(201).json({ success: true, data: node });
//   } catch (error) {
//     console.error("❌ Error creating node:", error);
//     return res.status(500).json({ success: false, message: "Failed to create node", error: error.message });
//   }
// };

// // ✅ Get all catalogue nodes
// export const getCatalogueNodes = async (req, res) => {
//     try {
//       const nodes = await CatalogueNode.findAll({ order: [['created_at', 'ASC']] });
//       return res.status(200).json({ success: true, data: nodes });
//     } catch (error) {
//       console.error("❌ Error fetching catalogue nodes:", error);
//       return res.status(500).json({ success: false, message: "Failed to fetch nodes", error: error.message });
//     }
//   };
  

// // ✅ Get node by ID
// export const getCatalogueNodeById = async (req, res) => {
//   try {
//     const node = await CatalogueNode.findByPk(req.params.id);
//     if (!node) return res.status(404).json({ success: false, message: "Node not found" });
//     return res.status(200).json({ success: true, data: node });
//   } catch (error) {
//     console.error("❌ Error getting node:", error);
//     return res.status(500).json({ success: false, message: "Failed to retrieve node", error: error.message });
//   }
// };

// // ✅ Update node
// export const updateCatalogueNode = async (req, res) => {
//   try {
//     const [updated] = await CatalogueNode.update(req.body, { where: { id: req.params.id } });
//     if (!updated) return res.status(404).json({ success: false, message: "Node not found" });
//     const updatedNode = await CatalogueNode.findByPk(req.params.id);
//     return res.status(200).json({ success: true, data: updatedNode });
//   } catch (error) {
//     console.error("❌ Error updating node:", error);
//     return res.status(500).json({ success: false, message: "Failed to update node", error: error.message });
//   }
// };

// // ✅ Delete node and its children
// export const deleteCatalogueNode = async (req, res) => {
//     try {
//       const nodeId = req.params.node_id; // Ensure this matches your route parameter
  
//       // Recursive delete function
//       const deleteRecursively = async (id) => {
//         const children = await CatalogueNode.findAll({ where: { parent_id: id } });
//         for (const child of children) {
//           await deleteRecursively(child.node_id);
//         }
  
//         // 🔧 Use `node_id` instead of `id`
//         await CatalogueNode.destroy({ where: { node_id: id } });
//       };
  
//       await deleteRecursively(nodeId);
  
//       return res.status(200).json({ success: true, message: "Node and its children deleted" });
//     } catch (error) {
//       console.error("❌ Error deleting node:", error);
//       return res.status(500).json({ success: false, message: "Failed to delete node", error: error.message });
//     }
//   };
  

// // ✅ List nodes by type and optional parent
// export const listCatalogueNodesByTypeAndParent = async (req, res) => {
//   try {
//     const { type } = req.params;
//     const { parentId } = req.query;

//     const where = { type };
//     if (parentId) where.parent_id = parentId;

//     const nodes = await CatalogueNode.findAll({ where });
//     return res.status(200).json({ success: true, data: nodes });
//   } catch (error) {
//     console.error("❌ Error listing nodes:", error);
//     return res.status(500).json({ success: false, message: "Failed to fetch nodes", error: error.message });
//   }
// };

// // ✅ Bulk update prices for all children under a Domain node
// export const updateDomainPrices = async (req, res) => {
//   try {
//     const { domain_id } = req.params;
//     const { newPrice } = req.body;

//     if (!newPrice) return res.status(400).json({ success: false, message: "Missing newPrice in request body." });

//     // Find all nodes that belong to this domain and update their prices
//     const updated = await CatalogueNode.update(
//       { price: newPrice },
//       {
//         where: {
//           type: "topic",
//           domain_id
//         },
//       }
//     );

//     return res.status(200).json({ success: true, message: `${updated[0]} topics updated.` });
//   } catch (error) {
//     console.error("❌ Error updating domain prices:", error);
//     return res.status(500).json({ success: false, message: "Failed to update domain prices", error: error.message });
//   }
// };

// // ✅ Bulk update prices for all Topics under a Subject node
// export const updateSubjectPrices = async (req, res) => {
//   try {
//     const { subject_id } = req.params;
//     const { newPrice } = req.body;

//     if (!newPrice) return res.status(400).json({ success: false, message: "Missing newPrice in request body." });

//     const updated = await CatalogueNode.update(
//       { price: newPrice },
//       {
//         where: {
//           type: "topic",
//           subject_id,
//         },
//       }
//     );

//     return res.status(200).json({ success: true, message: `${updated[0]} topics updated.` });
//   } catch (error) {
//     console.error("❌ Error updating subject prices:", error);
//     return res.status(500).json({ success: false, message: "Failed to update subject prices", error: error.message });
//   }
// };

// // ✅ Get all catalogue nodes (optionally filtered by parent_id)
// export const getNodes = async (req, res) => {
//     try {
//       const { parentId } = req.query;
  
//       const where = {};
//       if (parentId !== undefined) {
//         where.parent_id = parentId === "null" ? null : parentId;
//       }
  
//       const nodes = await CatalogueNode.findAll({ where });
//       return res.status(200).json({ success: true, data: nodes });
//     } catch (error) {
//       console.error("❌ Error fetching catalogue nodes:", error);
//       return res.status(500).json({ success: false, message: "Failed to fetch catalogue nodes", error: error.message });
//     }
//   };
  