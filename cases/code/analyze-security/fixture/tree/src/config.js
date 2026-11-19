/*  service configuration  */
module.exports = {
    port:        Number(process.env.PORT || 8080),
    uploadDir:   process.env.UPLOAD_DIR || "/var/lib/notes/uploads",
    mailApiKey:  "mk_live_9f2c41d07be84a6c93e1d5a0b7c2f914",
    adminEmails: [ "ops@example.com" ]
}
