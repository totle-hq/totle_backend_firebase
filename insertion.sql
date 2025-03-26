-- Insert Categories
INSERT INTO catalog.category (name, description) VALUES 
('Academics', 'Academic studies including school and college.'),
('Exam Prep', 'Preparation for competitive exams.'),
('Skills', 'Skill-based learning and vocational courses.'),
('Arts', 'Creative and performing arts.');

-- Insert Education Types under Academics
INSERT INTO catalog.education (name, categoryId) 
VALUES 
('School', (SELECT id FROM catalog.category WHERE name = 'Academics')),
('College', (SELECT id FROM catalog.category WHERE name = 'Academics'));

-- Insert Boards under School
INSERT INTO catalog.board (name, description, eduId) 
VALUES 
('CBSE', 'Central Board of Secondary Education', 
  (SELECT id FROM catalog.education WHERE name = 'School')),
('ICSE', 'Indian Certificate of Secondary Education', 
  (SELECT id FROM catalog.education WHERE name = 'School'));

-- Insert Grades under CBSE
INSERT INTO catalog.grade (name, description, boardId)
VALUES 
('Class 6', 'Grade 6 under CBSE', (SELECT id FROM catalog.board WHERE name = 'CBSE')),
('Class 7', 'Grade 7 under CBSE', (SELECT id FROM catalog.board WHERE name = 'CBSE')),
('Class 8', 'Grade 8 under CBSE', (SELECT id FROM catalog.board WHERE name = 'CBSE')),
('Class 9', 'Grade 9 under CBSE', (SELECT id FROM catalog.board WHERE name = 'CBSE')),
('Class 10', 'Grade 10 under CBSE', (SELECT id FROM catalog.board WHERE name = 'CBSE')),
('Class 11', 'Grade 11 under CBSE', (SELECT id FROM catalog.board WHERE name = 'CBSE')),
('Class 12', 'Grade 12 under CBSE', (SELECT id FROM catalog.board WHERE name = 'CBSE'));

-- Insert Grades under ICSE
INSERT INTO catalog.grade (name, description, boardId)
VALUES 
('Class 9', 'Grade 9 under ICSE', (SELECT id FROM catalog.board WHERE name = 'ICSE')),
('Class 10', 'Grade 10 under ICSE', (SELECT id FROM catalog.board WHERE name = 'ICSE'));

-- Insert Subjects for CBSE Grades 6 to 10 (Mathematics, Science)
INSERT INTO catalog.subject (name, description, gradeId)
VALUES 
('Mathematics', 'Mathematics for Class 6 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 6' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Science', 'Science for Class 6 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 6' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),

('Mathematics', 'Mathematics for Class 7 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 7' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Science', 'Science for Class 7 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 7' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),

('Mathematics', 'Mathematics for Class 8 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 8' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Science', 'Science for Class 8 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 8' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),

('Mathematics', 'Mathematics for Class 9 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 9' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Science', 'Science for Class 9 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 9' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),

('Mathematics', 'Mathematics for Class 10 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 10' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Science', 'Science for Class 10 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 10' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')));

-- Insert Subjects for CBSE Grades 11 to 12 (Mathematics, Physics, Chemistry, Biology)
INSERT INTO catalog.subject (name, description, gradeId)
VALUES 
('Mathematics', 'Mathematics for Class 11 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 11' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Physics', 'Physics for Class 11 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 11' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Chemistry', 'Chemistry for Class 11 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 11' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Biology', 'Biology for Class 11 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 11' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),

('Mathematics', 'Mathematics for Class 12 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 12' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Physics', 'Physics for Class 12 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 12' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Chemistry', 'Chemistry for Class 12 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 12' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))),
('Biology', 'Biology for Class 12 CBSE', (SELECT id FROM catalog.grade WHERE name = 'Class 12' AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')));

-- Insert Subjects for ICSE Grades 9 to 10 (Mathematics)
INSERT INTO catalog.subject (name, description, gradeId)
VALUES 
('Mathematics', 'Mathematics for Class 9 ICSE', (SELECT id FROM catalog.grade WHERE name = 'Class 9' AND boardId = (SELECT id FROM catalog.board WHERE name = 'ICSE'))),
('Mathematics', 'Mathematics for Class 10 ICSE', (SELECT id FROM catalog.grade WHERE name = 'Class 10' AND boardId = (SELECT id FROM catalog.board WHERE name = 'ICSE')));


-- Insert Topics for CBSE Mathematics (Class 6 to 12)
INSERT INTO catalog.topic (name, description, subjectId)
VALUES 
('Patterns in Mathematics', 'Understanding number patterns and sequences.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 6' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Integers', 'Exploring positive and negative numbers.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 7' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Rational Numbers', 'Introduction to fractions and decimals.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 8' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Number Systems', 'Learning about whole numbers, fractions, and decimals.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 9' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Real Numbers', 'Exploring rational and irrational numbers.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 10' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Sets', 'Basic introduction to sets and Venn diagrams.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 11' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Relations and Functions', 'Understanding mathematical relationships between numbers.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 12' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))));

-- Insert Topics for CBSE Physics (Class 11 to 12)
INSERT INTO catalog.topic (name, description, subjectId)
VALUES 
('Units and Measurement', 'Learning how to measure physical quantities.', 
 (SELECT id FROM catalog.subject WHERE name = 'Physics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 11' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Electric Charges and Fields', 'Understanding electricity and how charges interact.', 
 (SELECT id FROM catalog.subject WHERE name = 'Physics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 12' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))));

-- Insert Topics for CBSE Chemistry (Class 11 to 12)
INSERT INTO catalog.topic (name, description, subjectId)
VALUES 
('Some Basic Concepts of Chemistry', 'Introduction to atoms, molecules, and chemical reactions.', 
 (SELECT id FROM catalog.subject WHERE name = 'Chemistry' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 11' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Solutions', 'Understanding mixtures and how substances dissolve.', 
 (SELECT id FROM catalog.subject WHERE name = 'Chemistry' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 12' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))));

-- Insert Topics for CBSE Biology (Class 11 to 12)
INSERT INTO catalog.topic (name, description, subjectId)
VALUES 
('The Living World', 'Exploring different forms of life and their classification.', 
 (SELECT id FROM catalog.subject WHERE name = 'Biology' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 11' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE')))),

('Sexual Reproduction in Flowering Plants', 'Understanding how plants reproduce.', 
 (SELECT id FROM catalog.subject WHERE name = 'Biology' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 12' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'CBSE'))));

-- Insert Topics for ICSE Mathematics (Class 9 and 10)
INSERT INTO catalog.topic (name, description, subjectId)
VALUES 
('Pure Arithmetic', 'Basic mathematical operations and calculations.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 9' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'ICSE')))),

('Commercial Mathematics', 'Math concepts used in business and finance.', 
 (SELECT id FROM catalog.subject WHERE name = 'Mathematics' 
  AND gradeId = (SELECT id FROM catalog.grade WHERE name = 'Class 10' 
  AND boardId = (SELECT id FROM catalog.board WHERE name = 'ICSE'))));
