import { CatalogueNode } from "../Models/catalogueNode.model.js";

export const seedCatalogueDomains = async () => {
  const topLevelDomains = [
    { name: "Academics", description: "Academic courses" },
    { name: "Skills", description: "Skill development" },
    { name: "Exam Prep", description: "Exam preparation" },
    { name: "Arts", description: "Creative arts" },
  ];

  for (const domain of topLevelDomains) {
    const existing = await CatalogueNode.findOne({ where: { name: domain.name, parent_id: null } });

    if (!existing) {
      await CatalogueNode.create({
        name: domain.name,
        description: domain.description,
        is_domain: true,
        is_topic: false,
        prices: { bridger: 0, expert: 0, master: 0, legend: 0 },
        session_count: 1,
        status: "active",
        topic_params: null,
        prerequisites: [],
        parent_id: null
      });
      console.log(`✅ Inserted domain: ${domain.name}`);
    } else {
      console.log(`ℹ️ Domain already exists: ${domain.name}`);
    }
  }
};
