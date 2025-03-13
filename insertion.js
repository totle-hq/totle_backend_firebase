import { sequelize1 } from "./src/config/sequelize.js";
import { Board } from "./src/Models/BoardModel.js";
import { Education } from "./src/Models/EducationModel.js";

// Assuming you have already inserted Education (School or College)
async function insertBoardData() {
  try {
    await sequelize1.authenticate();  // Authenticate database connection

    // Find the 'Greenwood School' or 'MIT College of Engineering' (assuming their IDs exist in Education table)
    const school = await Education.findOne({ where: { name: 'School' } });

    if (school) {
      // Insert ICSE Board linked to School
      await Board.create({
        name: 'ICSE',  // Board name (ICSE)
        description: 'Indian Certificate of Secondary Education (ICSE) Board for School.',
        eduId: school.id,  // Link to the School (Education record)
      });

      // Insert CBSE Board linked to School
      await Board.create({
        name: 'CBSE',  // Board name (CBSE)
        description: 'Central Board of Secondary Education (CBSE) Board for School.',
        eduId: school.id,  // Link to the School (Education record)
      });


      console.log('✅ ICSE and CBSE Boards inserted successfully!');
    } else {
      console.log('❌ Education not found!');
    }
  } catch (error) {
    console.error('❌ Error inserting board data:', error);
  }
}

// Call the function to insert the data
insertBoardData();
