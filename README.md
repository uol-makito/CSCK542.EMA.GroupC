Application root: http://localhost:3000/

Below is summary of available functions.

**Functions available to multiple roles:**
- List all available courses.
  * GET /courses
  * GET /courses/available
- List all enrolments.
  * GET /courses/enrolments

**Functions available to Admins only:**
- List all courses.
  * GET /courses/all
- Enable specific course.
  * GET /enable/:courseID
- Disable specific course.
  * GET /disable/:courseID
- Assign course to teacher.
  * GET /assign/:courseID/:teacherID
- Unassign course from teacher.
  * GET /unassign/:courseID/:teacherID

**Functions available to Teachers only:**
- Set student's mark for specific enrolled course.
   * GET /set-mark/:enrolmentID/:newMark

**Functions available to Students only:**
- Enroll in specific course.
  * GET /enroll/:courseID
- Withdraw from specific course.
  * GET /withdraw/:courseID

**Note:** All requests must contains "user-id" in HTTP Headers.
