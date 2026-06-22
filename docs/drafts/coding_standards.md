# SIGILL CODING STANDARDS DOCUMENT
---

## File Structure
**Note**: Emdash was copypasted since it makes a better horizontal line in my opinion.
—└
```
Savanna-Sentinel/
|
|——backend/
|   |——init-db/          #Contains files to seed and initalise the database
|   |——tests/            #Contains the test files for the backend
|      |——integration/   #Contains the integration test files
|      └——unit/          #Contains the unit test files
|   |——app/
|      |——api/           #Contains the files used by various aspects of fastAPI
|         └——v1/         #Contains route information
|      |——core/          #Contains helper functions and some config files
|      |——models/        #Contains the database table structure
|      |——repositories/  #Contains files to interface with the database and retrieve data from the database
|      |——schemas/       #Contains DTO's and ViewModels to ensure data integrity
|      |——services/      #Contains main API functionality which router executes
|      └——workers/       #Contains celery/redis workers
|   |——Dockerfile
|   |——requirements.txt  #Contains Package information
|   └——.env              #User-generated file, contains keys and secrets.

```