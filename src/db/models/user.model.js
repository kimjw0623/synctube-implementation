
export default (sequelize, DataTypes) => {
    const User = sequelize.define("user", {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        password: {
            type: DataTypes.STRING
        },
        token: {
            type: DataTypes.STRING
        },
        nickname: {
            type: DataTypes.STRING
        },
        color: {
            type: DataTypes.STRING
        },
        auth: {
            type: DataTypes.STRING
        }
    });

    return User;
};