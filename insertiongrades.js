import { sequelize1 } from "./src/config/sequelize.js";
import { Board } from "./src/Models/BoardModel.js";
import { Education } from "./src/Models/EducationModel.js";
import { Grade } from "./src/Models/GradeModel.js";


async function insertBoardAndClassData() {
  try {
    await sequelize1.authenticate(); // Authenticate database connection

    // Find the 'School' in Education table
    const school = await Education.findOne({ where: { name: 'School' } });

    if (!school) {
      console.log('❌ Education (School) not found!');
      return;
    }

    // Insert or find ICSE Board linked to School
    let icseBoard = await Board.findOne({ where: { name: 'ICSE', eduId: school.id } });

    // Insert or find CBSE Board linked to School
    let cbseBoard = await Board.findOne({ where: { name: 'CBSE', eduId: school.id } });

    console.log('✅ Boards inserted/found successfully!');

    // Define Classes for CBSE (6 to 12)
    const cbseClasses = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
    const icseClasses = ['Class 9', 'Class 10'];

    for (const className of cbseClasses) {
      await Grade.create({
        name: className,
        description: `This is ${className} under CBSE board.`,
        eduId: school.id, // Links to School
        boardId: cbseBoard.id, // Links to CBSE Board
      });
    }

    // Insert Grades (Classes) under ICSE
    for (const className of icseClasses) {
      await Grade.create({
        name: className,
        description: `This is ${className} under ICSE board.`,
        eduId: school.id, // Links to School
        boardId: icseBoard.id, // Links to ICSE Board
      });
    }

    console.log('✅ Classes inserted successfully under CBSE and ICSE!');
  } catch (error) {
    console.error('❌ Error inserting board and class data:', error);
  }
}

// Call the function to insert the data
insertBoardAndClassData();
