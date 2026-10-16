const headers = ['Registration ID','Full Name','Email Address','WhatsApp Number','School','Gender','Date of Birth','Age',"Guardian's Email Address","Guardian's Phone Number",'Registration Date','Registration Status'];
const fields = ['id','full_name','email','whatsapp','school','gender','dob','age','guardian_email','guardian_phone','created_at','status'];
function cell(value) {
  let s = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
const row = values => values.map(cell).join(',') + '\r\n';
module.exports = { headers, fields, cell, row };
