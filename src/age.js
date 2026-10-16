// Legacy registrations retain their original DOB; derive age at registration for display/export.
function registrationAge(record){
  if(Number.isInteger(record.age))return record.age;
  if(!record.dob||!record.created_at)return null;
  const dob=new Date(record.dob),at=new Date(record.created_at);
  if(Number.isNaN(dob.valueOf())||Number.isNaN(at.valueOf()))return null;
  let age=at.getUTCFullYear()-dob.getUTCFullYear();
  if(at.getUTCMonth()<dob.getUTCMonth() || at.getUTCMonth()===dob.getUTCMonth()&&at.getUTCDate()<dob.getUTCDate())age--;
  return age>=0&&age<=120?age:null;
}
module.exports={registrationAge};
