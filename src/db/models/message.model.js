
export default (sequelize, DataTypes) => {
    const Message = sequelize.define("message", {
        user_id: {
            type: DataTypes.STRING,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        room_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'rooms',
                key: 'id'
            }
        },
        timestamp: {
            type: DataTypes.DATE
        },
        content: {
            type: DataTypes.STRING
        }
    });

    return Message;
};
