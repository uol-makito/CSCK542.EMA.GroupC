var express = require('express');
var router = express.Router();

const functions = require('../functions');

/*
ErrorNumber in ExecutionResult object
############################################################
# ErrorNumber   Description
# -1            Generic error.
# 0             Generic success.
# 400           Missing authorisation information.
# 401           Unauthorised access.
# 404           Not found.
############################################################

Roles for Users
############################################################
# RoleID        Description
# 1             Admin
# 2             Teacher
# 3             Student
############################################################
*/


//#region Configurations
const isLogToConsole = true;
//#endregion Configurations


//#region Shared Functions
function checkRole(userID, authorisedToRoleIDs, res, callback) {
  functions.getRoleID(userID, (err, roleID) => {
    if (err) {
      let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, err);
      if (isLogToConsole) console.error(er);
      res.status(500).send(er);
      callback(null, -1);
      return;
    }
    if (authorisedToRoleIDs.includes(roleID)) {
      callback(null, roleID);
    }
    else {
      let er = functions.getExecResult(401, `Unauthorised access (User ID: ${userID}) . `, null);
      if (isLogToConsole) console.error(er);
      res.status(401).send(er);
      callback(null, -1);
    }
    if (isLogToConsole) console.log(`# User ID: ${userID}, Role ID: ${roleID}`);
  });
}
//#endregion Shared Functions


//#region Functions available to multiple roles
// List all available courses.
router.get(['', '/available'], function (req, res) {
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Admins (Role ID: 1), Teachers (Role ID: 2), and Students (Role ID: 3).
  const authorisedToRoleIDs = [1, 2, 3];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT c.*, u.Name AS TeacherName FROM courses AS c
            LEFT JOIN users AS u ON u.RoleID = 2 AND u.UserID = c.TeacherID
        WHERE isAvailable = 1
        ORDER BY c.CourseID ASC;`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(err.errno, err.message, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          let er = functions.getExecResult(0, `Execution completed. ${results.length} record(s) found. `, results);
          if (isLogToConsole) console.log(er);
          res.status(200).send(er);
        });
    }
  });
});

// List all enrolments.
router.get('/enrolments', function (req, res) {
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Admins (Role ID: 1), Teachers (Role ID: 2), and Students (Role ID: 3).
  const authorisedToRoleIDs = [1, 2, 3];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      var query;
      switch (roleID)
      {
        // Show to admins: All enrolments.
        case 1:
          query =
            `SELECT
              e.EnrolmentID, e.Mark, e.CourseID,
              c.Title AS CourseTitle,
              c.TeacherID, u1.Name AS TeacherName,
              e.UserID AS StudentID, u2.Name AS StudentName
            FROM enrolments AS e
              LEFT JOIN courses AS c ON c.CourseID = e.CourseID
              LEFT JOIN users AS u1 ON u1.RoleID = 2 AND u1.UserID = c.TeacherID
              LEFT JOIN users AS u2 ON u2.RoleID = 3 AND u2.UserID = e.UserID
            ORDER BY e.EnrolmentID ASC;`
          break;
        // Show to teachers: Only courses assigned to him/her.
        case 2:
          query =
            `SELECT
              e.EnrolmentID, e.Mark, e.CourseID,
              c.Title AS CourseTitle,
              c.TeacherID, u1.Name AS TeacherName,
              e.UserID AS StudentID, u2.Name AS StudentName
            FROM enrolments AS e
              LEFT JOIN courses AS c ON c.CourseID = e.CourseID
              LEFT JOIN users AS u1 ON u1.RoleID = 2 AND u1.UserID = c.TeacherID
              LEFT JOIN users AS u2 ON u2.RoleID = 3 AND u2.UserID = e.UserID
            WHERE c.TeacherID = ${userID}
            ORDER BY e.EnrolmentID ASC;`
          break;
        // Show to students: Only courses enrolled by him/her.
        case 3:
          query =
            `SELECT
              e.EnrolmentID, e.Mark, e.CourseID,
              c.Title AS CourseTitle,
              c.TeacherID, u1.Name AS TeacherName,
              e.UserID AS StudentID, u2.Name AS StudentName
            FROM enrolments AS e
              LEFT JOIN courses AS c ON c.CourseID = e.CourseID
              LEFT JOIN users AS u1 ON u1.RoleID = 2 AND u1.UserID = c.TeacherID
              LEFT JOIN users AS u2 ON u2.RoleID = 3 AND u2.UserID = e.UserID
            WHERE e.UserID = ${userID}
            ORDER BY e.EnrolmentID ASC;`
          break;
        default:
          let er = functions.getExecResult(-1, `Unsupported User Role (ID: ${roleID}). `, null);
          if (isLogToConsole) console.error(er);
          res.status(500).send(er);
          return;
      }
      functions.getDbPool().query(
        query,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(err.errno, err.message, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          let er = functions.getExecResult(0, `Execution completed. ${results.length} record(s) found. `, results);
          if (isLogToConsole) console.log(er);
          res.status(200).send(er);
        });
    }
  });
});
//#endregion Functions available to multiple roles


//#region Functions available to Admins only
// List all courses.
router.get('/all', function (req, res) {
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Admins (Role ID: 1).
  const authorisedToRoleIDs = [1];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT c.*, u.Name AS TeacherName FROM courses AS c
          LEFT JOIN users AS u ON u.RoleID = 2 AND u.UserID = c.TeacherID
        ORDER BY c.CourseID ASC;`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(err.errno, err.message, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          let er = functions.getExecResult(0, `Execution completed. ${results.length} record(s) found. `, results);
          if (isLogToConsole) console.log(er);
          res.status(200).send(er);
        });
    }
  });
});

// Enable specific course.
router.get('/enable/:courseID', function (req, res) {
  var courseID = parseInt(req.params.courseID);
  if (isNaN(courseID)) {
    let er = functions.getExecResult(400, 'Invalid Course ID. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Admins (Role ID: 1).
  const authorisedToRoleIDs = [1];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT * FROM courses WHERE CourseID = ${courseID};`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          if (results.length > 0) {
            if (results[0].isAvailable == 0) {
              functions.getDbPool().execute(
                `UPDATE courses SET isAvailable = 1 WHERE CourseID = ${courseID};`,
                (err, results, fields) => {
                  if (err) {
                    let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                    if (isLogToConsole) console.error(er);
                    res.status(500).send(er);
                    return;
                  }
                  let er = functions.getExecResult(0, `Enabled Course (ID: ${courseID}) successfully. `, null);
                  if (isLogToConsole) console.log(er);
                  res.status(200).send(er);
                });
            }
            else {
              let er = functions.getExecResult(-1, `Targeted Course (ID: ${courseID}) is not disabled currently. `, null);
              if (isLogToConsole) console.error(er);
              res.status(500).send(er);
            }
          }
          else {
            let er = functions.getExecResult(404, `Could not find targeted Course (ID: ${courseID}). `, null);
            if (isLogToConsole) console.error(er);
            res.status(404).send(er);
          }
        });
    }
  });
});

// Disable specific course.
router.get('/disable/:courseID', function (req, res) {
  var courseID = parseInt(req.params.courseID);
  if (isNaN(courseID)) {
    let er = functions.getExecResult(400, 'Invalid Course ID. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Admins (Role ID: 1).
  const authorisedToRoleIDs = [1];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT * FROM courses WHERE CourseID = ${courseID};`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          if (results.length > 0) {
            if (results[0].isAvailable == 1) {
              functions.getDbPool().execute(
                `UPDATE courses SET isAvailable = 0 WHERE CourseID = ${courseID};`,
                (err, results, fields) => {
                  if (err) {
                    let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                    if (isLogToConsole) console.error(er);
                    res.status(500).send(er);
                    return;
                  }
                  let er = functions.getExecResult(0, `Disabled Course (ID: ${courseID}) successfully. `, null);
                  if (isLogToConsole) console.log(er);
                  res.status(200).send(er);
                });
            }
            else {
              let er = functions.getExecResult(-1, `Targeted Course (ID: ${courseID}) is not enabled currently. `, null);
              if (isLogToConsole) console.error(er);
              res.status(500).send(er);
            }
          }
          else {
            let er = functions.getExecResult(404, `Could not find targeted Course (ID: ${courseID}). `, null);
            if (isLogToConsole) console.error(er);
            res.status(404).send(er);
          }
        });
    }
  });
});

// Assign course to teacher.
router.get('/assign/:courseID/:teacherID', function (req, res) {
  var courseID = parseInt(req.params.courseID);
  if (isNaN(courseID)) {
    let er = functions.getExecResult(400, 'Invalid Course ID. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var teacherID = parseInt(req.params.teacherID);
  if (isNaN(teacherID)) {
    let er = functions.getExecResult(400, 'Invalid Teacher ID (User ID for Teacher). ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Admins (Role ID: 1).
  const authorisedToRoleIDs = [1];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT * FROM courses WHERE CourseID = ${courseID};`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          if (results.length > 0) {
            if (!results[0].TeacherID)
            {
              functions.getDbPool().query(
                `SELECT * FROM users WHERE RoleID = 2 AND UserID = ${teacherID}`,
                (err, results, fields) => {
                  if (err) {
                    let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                    if (isLogToConsole) console.error(er);
                    res.status(500).send(er);
                    return;
                  }
                  if (results.length > 0) {
                    functions.getDbPool().query(
                      `UPDATE courses SET TeacherID = ${teacherID} WHERE CourseID = ${courseID};`,
                      (err, results, fields) => {
                        if (err) {
                          let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                          if (isLogToConsole) console.error(er);
                          res.status(500).send(er);
                          return;
                        }
                        let er = functions.getExecResult(0, `Assigned Teacher (User ID: ${teacherID}) to Course (ID: ${courseID}) successfully. `, null);
                        if (isLogToConsole) console.log(er);
                        res.status(200).send(er);
                      });
                  }
                  else {
                    let er = functions.getExecResult(404, `Could not find targeted Teacher (User ID: ${teacherID}). `, null);
                    if (isLogToConsole) console.error(er);
                    res.status(404).send(er);
                  }
                }
              );
            }
            else {
              let er = functions.getExecResult(-1, `This Course (ID: ${courseID}) has an existing Teacher (User ID: ${teacherID}) assignment. `, null);
              if (isLogToConsole) console.error(er);
              res.status(500).send(er);
            }
          }
          else {
            let er = functions.getExecResult(404, `Could not find targeted Course (ID: ${courseID}). `, null);
            if (isLogToConsole) console.error(er);
            res.status(404).send(er);
          }
        });
    }
  });
});

// Unassign course from teacher.
router.get('/unassign/:courseID/:teacherID', function (req, res) {
  var courseID = parseInt(req.params.courseID);
  if (isNaN(courseID)) {
    let er = functions.getExecResult(400, 'Invalid Course ID. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var teacherID = parseInt(req.params.teacherID);
  if (isNaN(teacherID)) {
    let er = functions.getExecResult(400, 'Invalid Teacher ID (User ID for Teacher). ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Admins (Role ID: 1).
  const authorisedToRoleIDs = [1];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT * FROM courses WHERE CourseID = ${courseID} AND TeacherID = ${teacherID};`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          if (results.length > 0) {
            if (results.length > 0) {
              functions.getDbPool().query(
                `UPDATE courses SET TeacherID = NULL WHERE CourseID = ${courseID};`,
                (err, results, fields) => {
                  if (err) {
                    let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                    if (isLogToConsole) console.error(er);
                    res.status(500).send(er);
                    return;
                  }
                  let er = functions.getExecResult(0, `Unassigned Teacher (User ID: ${teacherID}) from Course (ID: ${courseID}) successfully. `, null);
                  if (isLogToConsole) console.log(er);
                  res.status(200).send(er);
                });
            }
            else {
              let er = functions.getExecResult(404, `Could not find targeted Teacher (User ID: ${teacherID}). `, null);
              if (isLogToConsole) console.error(er);
              res.status(404).send(er);
            }
          }
          else {
            let er = functions.getExecResult(404, `Could not find targeted Course (ID: ${courseID}) or it is not assign to targeted Teacher (User ID: ${teacherID}). `, null);
            if (isLogToConsole) console.error(er);
            res.status(404).send(er);
          }
        });
    }
  });
});
//#endregion Functions available to Admins only


//#region Functions available to Teachers only
// Set student's mark for specific enrolled course.
router.get('/set-mark/:enrolmentID/:newMark', function (req, res) {
  var enrolmentID = parseInt(req.params.enrolmentID);
  if (isNaN(enrolmentID)) {
    let er = functions.getExecResult(400, 'Invalid Enrolment ID value. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var newMark = parseInt(req.params.newMark);
  if (isNaN(newMark)) {
    let er = functions.getExecResult(400, 'Invalid New Mark value. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Teachers (Role ID: 2).
  const authorisedToRoleIDs = [2];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT
          e.*, c.TeacherID
        FROM enrolments AS e
          LEFT JOIN courses AS c ON c.CourseID = e.CourseID
        WHERE e.EnrolmentID = ${enrolmentID};`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          if (results.length > 0) {
            if (results[0].TeacherID == userID) {
              functions.getDbPool().execute(
                `UPDATE enrolments SET Mark = ${newMark} WHERE EnrolmentID = ${enrolmentID};`,
                (err, results, fields) => {
                  if (err) {
                    let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                    if (isLogToConsole) console.error(er);
                    res.status(500).send(er);
                    return;
                  }
                  let er = functions.getExecResult(0, `Set Mark (${newMark}) for Enrolment (ID: ${enrolmentID}) successfully. `, null);
                  if (isLogToConsole) console.log(er);
                  res.status(200).send(er);
                });
            }
            else {
              let er = functions.getExecResult(-1, `The Course of this Enrolment (ID: ${enrolmentID}) is not assigned to current User (ID: ${userID}). `, null);
              if (isLogToConsole) console.error(er);
              res.status(500).send(er);
            }
          }
          else {
            let er = functions.getExecResult(404, `Could not find targeted Enrolment (ID: ${enrolmentID}). `, null);
            if (isLogToConsole) console.error(er);
            res.status(404).send(er);
          }
        });
    }
  });
});
//#endregion Functions available to Teachers only


//#region Functions available to Students only
// Enroll in specific course.
router.get('/enroll/:courseID', function (req, res) {
  var courseID = parseInt(req.params.courseID);
  if (isNaN(courseID)) {
    let er = functions.getExecResult(400, 'Invalid Course ID. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Students (Role ID: 3).
  const authorisedToRoleIDs = [3];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT COUNT(*) As ItemCount FROM courses WHERE isAvailable = 1 AND CourseID = ${courseID};`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          if (results[0].ItemCount > 0) {
            functions.getDbPool().query(
              `SELECT * FROM enrolments WHERE CourseID = ${courseID} AND UserID = ${userID};`,
              (err, results, fields) => {
                if (err) {
                  let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                  if (isLogToConsole) console.error(er);
                  res.status(500).send(er);
                  return;
                }
                if (results.length == 0) {
                  functions.getDbPool().execute(
                    `INSERT INTO enrolments (CourseID, UserID) VALUES (${courseID}, ${userID});`,
                    (err, results, fields) => {
                      if (err) {
                        let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                        if (isLogToConsole) console.error(er);
                        res.status(500).send(er);
                        return;
                      }
                      let er = functions.getExecResult(0, `Enrolled in Course (ID: ${courseID}) successfully. `, null);
                      if (isLogToConsole) console.log(er);
                      res.status(200).send(er);
                    });
                }
                else {
                  let er = functions.getExecResult(500, `This User (ID: ${userID}) has already enrolled in this Course (ID: ${courseID}). `, null);
                  if (isLogToConsole) console.error(er);
                  res.status(500).send(er);
                }
              });
          }
          else {
            let er = functions.getExecResult(404, `Could not find targeted Course (ID: ${courseID}) or it is not available. `, null);
            if (isLogToConsole) console.error(er);
            res.status(404).send(er);
          }
        });
    }
  });
});

// Withdraw from specific course.
router.get('/withdraw/:courseID', function (req, res) {
  var courseID = parseInt(req.params.courseID);
  if (isNaN(courseID)) {
    let er = functions.getExecResult(400, 'Invalid Course ID. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  var userID = parseInt(req.header('user-id'));
  if (isNaN(userID)) {
    let er = functions.getExecResult(400, 'Invalid User ID. Probably due to missing [user-id] Header. ', null);
    if (isLogToConsole) console.error(er);
    res.status(400).send(er);
    return;
  }
  // This operation can only be run by Students (Role ID: 3).
  const authorisedToRoleIDs = [3];
  checkRole(userID, authorisedToRoleIDs, res, (err, roleID) => {
    if (roleID != -1) {
      functions.getDbPool().query(
        `SELECT * FROM enrolments WHERE CourseID = ${courseID} AND UserID = ${userID};`,
        (err, results, fields) => {
          if (err) {
            let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
            if (isLogToConsole) console.error(er);
            res.status(500).send(er);
            return;
          }
          if (results.length > 0) {
            if (!results[0].Mark) {
              functions.getDbPool().execute(
                `DELETE FROM enrolments WHERE CourseID = ${courseID} AND UserID = ${userID};`,
                (err, results, fields) => {
                  if (err) {
                    let er = functions.getExecResult(-1, `[${err.errno}] ${err.code}: ${err.message}`, null);
                    if (isLogToConsole) console.error(er);
                    res.status(500).send(er);
                    return;
                  }
                  let er = functions.getExecResult(0, `Withdraw from Course (ID: ${courseID}) successfully. `, null);
                  if (isLogToConsole) console.log(er);
                  res.status(200).send(er);
                });
            }
            else {
              let er = functions.getExecResult(-1, `Cannot withdraw from current Course (ID: ${courseID}) as mark has been assigned by the teacher.`, null);
              if (isLogToConsole) console.error(er);
              res.status(500).send(er);
            }
          }
          else {
            let er = functions.getExecResult(404, `Could not find targeted Enrolment (Course ID: ${courseID}, User ID: ${userID}). `, null);
            if (isLogToConsole) console.error(er);
            res.status(404).send(er);
          }
        });
    }
  });
});
//#endregion Functions available to Students only


module.exports = router;
