const { z } = require('zod');
const text = z.string().trim().min(1, 'This field is required.').max(200, 'Use no more than 200 characters.');
const email = z.string().trim().toLowerCase().max(254).email('Enter a valid email address.');
const { normalizePhone, validPhone } = require('./phone');
const {registrationAge}=require('./age');
const phone = z.string().trim().max(40).refine(validPhone, 'Enter an international phone number beginning with + and country code (8–15 digits).').transform(normalizePhone);
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value && value <= new Date().toISOString().slice(0,10);
}
const isMinor = age => age < 18;
const gender = z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say'], { error: 'Select a gender option.' });
const registrationSchema = z.object({
  full_name: text, email, whatsapp: phone, school: text, gender,
  age: z.number().int('Enter your age as a whole number.').min(0, 'Age cannot be negative.').max(120, 'Enter an age between 0 and 120.'),
  dob: z.string().refine(validDate, 'Enter a valid date of birth that is not in the future.'),
  guardian_email: email, guardian_phone: phone,
  consent: z.literal(true, { error: 'Consent is required.' })
}).superRefine((data,ctx)=>{
  if(validDate(data.dob) && data.age!==registrationAge({dob:data.dob,created_at:new Date().toISOString()}))ctx.addIssue({code:'custom',path:['age'],message:'Age must match your date of birth.'});
});
module.exports = { registrationSchema, validDate, isMinor };
