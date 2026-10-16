const registrationValidator = {$jsonSchema:{
  bsonType:'object',
  required:['id','full_name','email','whatsapp','school','gender','age','dob','guardian_email','guardian_phone','created_at','status','consent_role','consent_version','consent_at'],
  properties:{...Object.fromEntries(['id','full_name','email','whatsapp','school','gender','dob','guardian_email','guardian_phone','created_at','status','consent_role','consent_version','consent_at'].map(key=>[key,{bsonType:'string',minLength:1}])),age:{bsonType:['int','long','double','decimal'],minimum:0,maximum:120,multipleOf:1}}
}};
module.exports={registrationValidator};
