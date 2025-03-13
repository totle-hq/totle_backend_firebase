import { sequelize1 } from "./src/config/sequelize.js";
import { Education } from "./src/Models/EducationModel.js";
import { Grade } from "./src/Models/GradeModel.js";
import { Board } from  "./src/Models/BoardModel.js"
import { Subject } from "./src/Models/SubjectModel.js";

async function insertSubjects() {
  try {
    await sequelize1.authenticate(); // Authenticate database connection

    // Find the 'School' in the Education table
    const school = await Education.findOne({ where: { name: "School" } });

    if (!school) {
      console.log("❌ Education (School) not found!");
      return;
    }

    // Find CBSE and ICSE Boards
    const cbseBoard = await Board.findOne({ where: { name: "CBSE", eduId: school.id } });
    const icseBoard = await Board.findOne({ where: { name: "ICSE", eduId: school.id } });

    if (!cbseBoard || !icseBoard) {
      console.log("❌ CBSE or ICSE Board not found!");
      return;
    }

    // Define subjects for CBSE
    const cbseSubjects = {
      "Class 6": ["Mathematics", "Science"],
      "Class 7": ["Mathematics", "Science"],
      "Class 8": ["Mathematics", "Science"],
      "Class 9": ["Mathematics", "Science"],
      "Class 10": ["Mathematics", "Science"],
      "Class 11": ["Mathematics", "Physics", "Chemistry", "Biology"],
      "Class 12": ["Mathematics", "Physics", "Chemistry", "Biology"]
    };

    // Define subjects for ICSE
    const icseSubjects = {
      "Class 9": ["Mathematics"],
      "Class 10": ["Mathematics"]
    };

    // Insert subjects for CBSE
    for (const [gradeName, subjects] of Object.entries(cbseSubjects)) {
      const grade = await Grade.findOne({ where: { name: gradeName, eduId: school.id, boardId: cbseBoard.id } });

      if (grade) {
        for (const subject of subjects) {
          await Subject.create({
            name: subject,
            description: `This is ${subject} for ${gradeName} under CBSE board.`,
            gradeId: grade.id,
          });
        }
      }
    }

    // Insert subjects for ICSE
    for (const [gradeName, subjects] of Object.entries(icseSubjects)) {
      const grade = await Grade.findOne({ where: { name: gradeName, eduId: school.id, boardId: icseBoard.id } });

      if (grade) {
        for (const subject of subjects) {
          await Subject.create({
            name: subject,
            description: `This is ${subject} for ${gradeName} under ICSE board.`,
            gradeId: grade.id,
          });
        }
      }
    }

    console.log("✅ Subjects inserted successfully under CBSE and ICSE grades!");

  } catch (error) {
    console.error("❌ Error inserting subjects:", error);
  }
}

// Call the function to insert the subjects
insertSubjects();
